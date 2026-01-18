import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, stripe-signature',
};

async function verifyStripeSignature(body: string, signature: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(body);
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(stripeWebhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureParts = signature.split(',');
    const timestamp = signatureParts.find(part => part.startsWith('t='))?.split('=')[1];
    const expectedSig = signatureParts.find(part => part.startsWith('v1='))?.split('=')[1];

    if (!timestamp || !expectedSig) return false;

    const payload = `${timestamp}.${body}`;
    const payloadData = encoder.encode(payload);

    const expectedSigBytes = new Uint8Array(
      expectedSig.match(/.{2}/g)!.map(byte => parseInt(byte, 16))
    );

    return await crypto.subtle.verify('HMAC', key, expectedSigBytes, payloadData);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

function getPlanFromPriceId(priceId: string): string {
  const priceMap: Record<string, string> = {
    'price_core_monthly': 'core',
    'price_core_annual': 'core',
    'price_professional_monthly': 'professional',
    'price_professional_annual': 'professional',
  };
  return priceMap[priceId] || 'free';
}

function getBillingCycle(priceId: string): string | null {
  if (priceId.includes('monthly')) return 'monthly';
  if (priceId.includes('annual')) return 'annual';
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'No signature provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.text();

    const isValid = await verifyStripeSignature(body, signature);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const event = JSON.parse(body);
    console.log('Stripe webhook event:', event.type);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        const clientReferenceId = session.client_reference_id;

        const priceId = session.line_items?.data[0]?.price?.id || '';
        const plan = getPlanFromPriceId(priceId);
        const billingCycle = getBillingCycle(priceId);

        const maxEditors = plan === 'core' ? 1 : plan === 'professional' ? 3 : 999;

        const { error } = await supabase
          .from('user_profiles')
          .update({
            plan: plan,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: 'active',
            billing_cycle: billingCycle,
            max_editors: maxEditors,
          })
          .eq('id', clientReferenceId);

        if (error) {
          console.error('Error updating user profile:', error);
          return new Response(
            JSON.stringify({ error: 'Database update failed' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Subscription activated for user ${clientReferenceId}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const status = subscription.status;

        if (status !== 'active') {
          const { error } = await supabase
            .from('user_profiles')
            .update({
              plan: 'free',
              subscription_status: status,
              max_editors: 999,
            })
            .eq('stripe_customer_id', customerId);

          if (error) {
            console.error('Error downgrading user:', error);
          } else {
            console.log(`User downgraded to free plan: ${customerId}`);
          }
        } else {
          const priceId = subscription.items?.data[0]?.price?.id || '';
          const plan = getPlanFromPriceId(priceId);
          const billingCycle = getBillingCycle(priceId);
          const maxEditors = plan === 'core' ? 1 : plan === 'professional' ? 3 : 999;

          const { error } = await supabase
            .from('user_profiles')
            .update({
              plan: plan,
              subscription_status: 'active',
              billing_cycle: billingCycle,
              max_editors: maxEditors,
            })
            .eq('stripe_customer_id', customerId);

          if (error) {
            console.error('Error updating subscription:', error);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const { error } = await supabase
          .from('user_profiles')
          .update({
            plan: 'free',
            subscription_status: 'canceled',
            max_editors: 999,
          })
          .eq('stripe_customer_id', customerId);

        if (error) {
          console.error('Error handling cancellation:', error);
        } else {
          console.log(`Subscription canceled for customer: ${customerId}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
