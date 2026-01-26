import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from("user_profiles")
      .select("organisation_id, role, is_platform_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      throw new Error("User profile not found");
    }

    const isOrgAdmin = profile.role === "admin";
    const isPlatformAdmin = profile.is_platform_admin === true;

    if (!isOrgAdmin && !isPlatformAdmin) {
      throw new Error("Only organisation admins can delete logos");
    }

    const { organisation_id } = await req.json();

    if (!organisation_id) {
      throw new Error("No organisation_id provided");
    }

    if (profile.organisation_id !== organisation_id && !isPlatformAdmin) {
      throw new Error("Cannot delete logo for different organisation");
    }

    const { data: org, error: orgError } = await supabaseClient
      .from("organisations")
      .select("branding_logo_path")
      .eq("id", organisation_id)
      .maybeSingle();

    if (orgError || !org) {
      throw new Error("Organisation not found");
    }

    if (org.branding_logo_path) {
      const { error: deleteError } = await supabaseClient.storage
        .from("org-assets")
        .remove([org.branding_logo_path]);

      if (deleteError) {
        console.error("Storage delete error:", deleteError);
      }
    }

    const { error: updateError } = await supabaseClient
      .from("organisations")
      .update({
        branding_logo_path: null,
        branding_updated_at: new Date().toISOString(),
      })
      .eq("id", organisation_id);

    if (updateError) {
      throw new Error(`Failed to update organisation: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
