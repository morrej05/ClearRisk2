import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, stripe-signature",
};

type PlanType = 'core' | 'professional';
type PlanInterval = 'month' | 'year';

interface StripePlanMapping {
  planType: PlanType;
  interval: PlanInterval;
}

const PRICE_TO_PLAN: Record<string, StripePlanMapping> = {
  [Deno.env.get("STRIPE_PRICE_CORE_MONTHLY") || ""]: { planType: "core", interval: "month" },
  [Deno.env.get("STRIPE_PRICE_CORE_ANNUAL") || ""]: { planType: "core", interval: "year" },
  [Deno.env.get("STRIPE_PRICE_PRO_MONTHLY") || ""]: { planType: "professional", interval: "month" },
  [Deno.env.get("STRIPE_PRICE_PRO_ANNUAL") || ""]: { planType: "professional", interval: "year" },
};

function getPlanFromPriceId(priceId: string): StripePlanMapping | null {
  return PRICE_TO_PLAN[priceId] || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeSecretKey || !webhookSecret) {
      throw new Error("Stripe configuration missing");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-11-20.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      throw new Error("Missing stripe-signature header");
    }

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return new Response(
        JSON.stringify({ error: "Webhook signature verification failed" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { error: idempotencyError } = await supabase
      .from("stripe_webhook_events")
      .insert({
        event_id: event.id,
        event_type: event.type,
        received_at: new Date().toISOString(),
        processed: false
      });

    if (idempotencyError && idempotencyError.code === '23505') {
      console.log(`Event ${event.id} already processed, skipping`);
      return new Response(
        JSON.stringify({ received: true, skipped: true }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let organisationId: string | null = null;

    async function getOrganisationId(
      metadata: Record<string, string> | null | undefined,
      subscriptionId?: string,
      customerId?: string
    ): Promise<string | null> {
      if (metadata?.organisation_id) {
        return metadata.organisation_id;
      }

      if (subscriptionId) {
        const { data: org } = await supabase
          .from("organisations")
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();
        if (org) return org.id;
      }

      if (customerId) {
        const { data: org } = await supabase
          .from("organisations")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();
        if (org) return org.id;
      }

      return null;
    }

    async function updateOrganisationSubscription(
      orgId: string,
      subscription: Stripe.Subscription
    ) {
      const priceId = subscription.items.data[0]?.price.id;
      const planMapping = getPlanFromPriceId(priceId);

      if (!planMapping) {
        console.error(`Unknown price ID: ${priceId}`);
        return;
      }

      const updateData: any = {
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer as string,
        stripe_price_id: priceId,
        stripe_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        subscription_status: subscription.status,
        cancel_at_period_end: subscription.cancel_at_period_end || false,
        plan_interval: planMapping.interval,
        updated_at: new Date().toISOString(),
      };

      if (subscription.status === 'active' || subscription.status === 'trialing') {
        updateData.plan_type = planMapping.planType;
      } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
        updateData.plan_type = 'core';
      }

      await supabase
        .from("organisations")
        .update(updateData)
        .eq("id", orgId);

      console.log(`Updated org ${orgId}: plan=${updateData.plan_type}, status=${subscription.status}`);
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        organisationId = await getOrganisationId(
          session.metadata,
          session.subscription as string,
          session.customer as string
        );

        if (!organisationId) {
          console.error("No organisation found for checkout session");
          break;
        }

        if (session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          await updateOrganisationSubscription(organisationId, subscription);
        }
        break;
      }

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;

        organisationId = await getOrganisationId(
          subscription.metadata,
          subscription.id,
          subscription.customer as string
        );

        if (!organisationId) {
          console.error("No organisation found for subscription");
          break;
        }

        await updateOrganisationSubscription(organisationId, subscription);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        organisationId = await getOrganisationId(
          subscription.metadata,
          subscription.id,
          subscription.customer as string
        );

        if (!organisationId) {
          console.error("No organisation found for subscription");
          break;
        }

        await updateOrganisationSubscription(organisationId, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        organisationId = await getOrganisationId(
          subscription.metadata,
          subscription.id,
          subscription.customer as string
        );

        if (!organisationId) {
          console.error("No organisation found for subscription");
          break;
        }

        await supabase
          .from("organisations")
          .update({
            plan_type: "core",
            subscription_status: "canceled",
            stripe_subscription_id: null,
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", organisationId);

        console.log(`Canceled subscription for org ${organisationId}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;

        if (invoice.subscription) {
          organisationId = await getOrganisationId(
            null,
            invoice.subscription as string,
            invoice.customer as string
          );

          if (organisationId) {
            await supabase
              .from("organisations")
              .update({
                subscription_status: "past_due",
                updated_at: new Date().toISOString(),
              })
              .eq("id", organisationId);

            console.log(`Payment failed for org ${organisationId}`);
          }
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;

        if (invoice.subscription) {
          organisationId = await getOrganisationId(
            null,
            invoice.subscription as string,
            invoice.customer as string
          );

          if (organisationId) {
            const subscription = await stripe.subscriptions.retrieve(
              invoice.subscription as string
            );
            await updateOrganisationSubscription(organisationId, subscription);
            console.log(`Payment succeeded for org ${organisationId}`);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    await supabase
      .from("stripe_webhook_events")
      .update({ processed: true })
      .eq("event_id", event.id);

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Webhook processing failed" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
