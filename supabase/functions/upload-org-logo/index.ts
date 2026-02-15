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

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  const respond = (status: number, payload: Record<string, unknown>) =>
    new Response(JSON.stringify(payload), { status, headers: jsonHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    console.log("[upload-org-logo] authHeader present:", Boolean(authHeader));
    console.log("[upload-org-logo] token present:", Boolean(token));

    if (!authHeader || !token) {
      return respond(401, {
        error: "Missing or malformed Authorization header",
        details: {
          authHeaderPresent: Boolean(authHeader),
          tokenPresent: Boolean(token),
          expectedFormat: "Authorization: Bearer <access_token>",
        },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    console.log("[upload-org-logo] getUser ok:", Boolean(user) && !userError);

    if (userError || !user) {
      console.error("[upload-org-logo] getUser failed:", userError);
      return respond(401, {
        error: "Invalid or expired access token",
        details: {
          message: userError?.message ?? "No user returned",
          code: userError?.code ?? null,
          status: userError?.status ?? null,
        },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: profile, error: profileError } = await supabaseClient
      .from("user_profiles")
      .select("organisation_id, role, is_platform_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return respond(403, {
        error: "User profile not found",
        details: {
          message: profileError?.message ?? "No profile returned",
          code: profileError?.code ?? null,
        },
      });
    }

    const isOrgAdmin = profile.role === "admin";
    const isPlatformAdmin = profile.is_platform_admin === true;

    if (!isOrgAdmin && !isPlatformAdmin) {
      return respond(403, {
        error: "Only organisation admins can upload logos",
      });
    }

    const formData = await req.formData();
    const file = formData.get("logo") as File;
    const orgId = formData.get("organisation_id") as string;

    console.log("[upload-org-logo] organisation_id:", orgId ?? null);

    if (!file) {
      return respond(400, { error: "No file provided" });
    }

    if (!orgId) {
      return respond(400, { error: "No organisation_id provided" });
    }

    if (profile.organisation_id !== orgId && !isPlatformAdmin) {
      return respond(403, { error: "Cannot upload logo for different organisation" });
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      return respond(400, { error: "Invalid file type. Only PNG, JPG, and SVG are allowed." });
    }

    const maxSize = 1024 * 1024;
    if (file.size > maxSize) {
      return respond(400, { error: "File too large. Maximum size is 1MB." });
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
      return respond(400, { error: `Upload failed: ${uploadError.message}` });
    }

    const { error: updateError } = await supabaseClient
      .from("organisations")
      .update({
        branding_logo_path: filePath,
        branding_updated_at: new Date().toISOString(),
      })
      .eq("id", orgId);

    if (updateError) {
      return respond(400, { error: `Failed to update organisation: ${updateError.message}` });
    }

    return respond(200, { success: true, path: filePath });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[upload-org-logo] unhandled error:", error);
    return respond(500, { error: message });
  }
});
