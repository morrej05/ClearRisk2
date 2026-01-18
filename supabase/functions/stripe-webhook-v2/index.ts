import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, stripe-signature",
};

const PLAN_PRICE_MAP: Record<string, { plan: string; maxEditors: number; cycle: string }> = {
  [Deno.env.get("STRIPE_PRICE_CORE_MONTHLY") || ""]: { plan: "core", maxEditors: 1, cycle: "monthly" },
  [Deno.env.get("STRIPE_PRICE_CORE_ANNUAL") || ""]: { plan: "core", maxEditors: 1, cycle: "annual" },
  [Deno.env.get("STRIPE_PRICE_PRO_MONTHLY") || ""]: { plan: "professional", maxEditors: 3, cycle: "monthly" },
  [Deno.env.get("STRIPE_PRICE_PRO_ANNUAL") || ""]: { plan: "professional", maxEditors: 3, cycle: "annual" },
};

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

    const { data: existingEvent } = await supabase
      .from("stripe_events_processed")
      .select("id")
      .eq("stripe_event_id", event.id)
      .maybeSingle();

    if (existingEvent) {
      console.log(`Event ${event.id} already processed, skipping`);
      return new Response(
        JSON.stringify({ received: true, skipped: true }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let organisationId: string | null = null;
    let updateData: any = {};

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        organisationId = session.metadata?.organisation_id || null;

        if (!organisationId) {
          console.error("No organisation_id in checkout session metadata");
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );

        const priceId = subscription.items.data[0]?.price.id;
        const planConfig = PLAN_PRICE_MAP[priceId];

        if (planConfig) {
          updateData = {
            plan_type: planConfig.plan,
            subscription_status: "active",
            max_editors: planConfig.maxEditors,
            billing_cycle: planConfig.cycle,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: session.customer as string,
            updated_at: new Date().toISOString(),
          };

          await supabase
            .from("organisations")
            .update(updateData)
            .eq("id", organisationId);

          console.log(`Activated ${planConfig.plan} plan for org ${organisationId}`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        organisationId = subscription.metadata?.organisation_id || null;

        if (!organisationId) {
          const { data: org } = await supabase
            .from("organisations")
            .select("id")
            .eq("stripe_subscription_id", subscription.id)
            .maybeSingle();

          organisationId = org?.id || null;
        }

        if (!organisationId) {
          console.error("No organisation found for subscription");
          break;
        }

        const priceId = subscription.items.data[0]?.price.id;
        const planConfig = PLAN_PRICE_MAP[priceId];
        const status = subscription.status;

        if (status === "active" && planConfig) {
          updateData = {
            plan_type: planConfig.plan,
            subscription_status: "active",
            max_editors: planConfig.maxEditors,
            billing_cycle: planConfig.cycle,
            updated_at: new Date().toISOString(),
          };
        } else if (status === "past_due") {
          updateData = {
            subscription_status: "past_due",
            updated_at: new Date().toISOString(),
          };
        } else if (status === "canceled" || status === "unpaid") {
          updateData = {
            plan_type: "free",
            subscription_status: "canceled",
            max_editors: 0,
            updated_at: new Date().toISOString(),
          };
        }

        if (Object.keys(updateData).length > 0) {
          await supabase
            .from("organisations")
            .update(updateData)
            .eq("id", organisationId);

          console.log(`Updated subscription for org ${organisationId}: ${status}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        organisationId = subscription.metadata?.organisation_id || null;

        if (!organisationId) {
          const { data: org } = await supabase
            .from("organisations")
            .select("id")
            .eq("stripe_subscription_id", subscription.id)
            .maybeSingle();

          organisationId = org?.id || null;
        }

        if (!organisationId) {
          console.error("No organisation found for subscription");
          break;
        }

        updateData = {
          plan_type: "free",
          subscription_status: "canceled",
          max_editors: 0,
          stripe_subscription_id: null,
          updated_at: new Date().toISOString(),
        };

        await supabase
          .from("organisations")
          .update(updateData)
          .eq("id", organisationId);

        console.log(`Canceled subscription for org ${organisationId}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    await supabase.from("stripe_events_processed").insert({
      stripe_event_id: event.id,
      event_type: event.type,
      organisation_id: organisationId,
      metadata: {
        processed: true,
        event_type: event.type,
        timestamp: new Date().toISOString(),
      },
    });

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
