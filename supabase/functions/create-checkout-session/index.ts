import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CheckoutRequest {
  priceId: string;
  organisationId: string;
  successUrl: string;
  cancelUrl: string;
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
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-11-20.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { priceId, organisationId, successUrl, cancelUrl }: CheckoutRequest = await req.json();

    if (!priceId || !organisationId) {
      throw new Error("Missing required parameters");
    }

    const { data: organisation, error: orgError } = await supabase
      .from("organisations")
      .select("*")
      .eq("id", organisationId)
      .single();

    if (orgError || !organisation) {
      throw new Error("Organisation not found");
    }

    const { data: userProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role, organisation_id")
      .eq("id", user.id)
      .single();

    if (profileError || !userProfile) {
      throw new Error("User profile not found");
    }

    if (userProfile.organisation_id !== organisationId || userProfile.role !== "admin") {
      throw new Error("Only organisation admins can create checkout sessions");
    }

    let stripeCustomerId = organisation.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          organisation_id: organisationId,
          user_id: user.id,
        },
      });
      stripeCustomerId = customer.id;

      await supabase
        .from("organisations")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", organisationId);
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        organisation_id: organisationId,
        user_id: user.id,
      },
      subscription_data: {
        metadata: {
          organisation_id: organisationId,
          user_id: user.id,
        },
      },
    });

    return new Response(
      JSON.stringify({ sessionUrl: session.url }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to create checkout session" }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
