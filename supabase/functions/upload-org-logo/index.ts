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
      throw new Error("Only organisation admins can upload logos");
    }

    const formData = await req.formData();
    const file = formData.get("logo") as File;
    const orgId = formData.get("organisation_id") as string;

    if (!file) {
      throw new Error("No file provided");
    }

    if (!orgId) {
      throw new Error("No organisation_id provided");
    }

    if (profile.organisation_id !== orgId && !isPlatformAdmin) {
      throw new Error("Cannot upload logo for different organisation");
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Invalid file type. Only PNG, JPG, and SVG are allowed.");
    }

    const maxSize = 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error("File too large. Maximum size is 1MB.");
    }

    const fileExt = file.name.split(".").pop();
    const fileName = `logo.${fileExt}`;
    const filePath = `org-logos/${orgId}/${fileName}`;

    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabaseClient.storage
      .from("org-assets")
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { error: updateError } = await supabaseClient
      .from("organisations")
      .update({
        branding_logo_path: filePath,
        branding_updated_at: new Date().toISOString(),
      })
      .eq("id", orgId);

    if (updateError) {
      throw new Error(`Failed to update organisation: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, path: filePath }),
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
