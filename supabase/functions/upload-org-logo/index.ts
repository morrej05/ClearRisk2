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
    // Extract Authorization header
    const authHeader = req.headers.get("Authorization");
    console.log("[Logo Upload] Token present?", !!authHeader);

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("[Logo Upload] Missing or invalid Authorization header");
      return new Response(
        JSON.stringify({
          error: "Missing or invalid Authorization header",
          details: "Authorization header must be in format: Bearer <token>"
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.replace("Bearer ", "");

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Validate token using admin client
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    console.log("[Logo Upload] getUser success?", !!user);

    if (userError) {
      console.error("[Logo Upload] Auth error:", {
        message: userError.message,
        status: userError.status,
      });
      return new Response(
        JSON.stringify({
          error: "Authentication failed",
          details: userError.message
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!user) {
      console.error("[Logo Upload] No user found from token");
      return new Response(
        JSON.stringify({
          error: "Authentication failed",
          details: "No user found from token"
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("[Logo Upload] User authenticated:", user.id);

    // Parse FormData
    const formData = await req.formData();
    const file = formData.get("logo") as File;
    const organisationId = String(formData.get("organisation_id") || "");

    console.log("[Logo Upload] organisationId received?", !!organisationId);

    if (!file) {
      return new Response(
        JSON.stringify({ error: "No file provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!organisationId) {
      return new Response(
        JSON.stringify({ error: "No organisation_id provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check user authorization (admin role or platform admin)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("organisation_id, role, is_platform_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      console.error("[Logo Upload] Profile lookup error:", profileError?.message);
      return new Response(
        JSON.stringify({
          error: "User profile not found",
          details: profileError?.message
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const isOrgAdmin = profile.role === "admin";
    const isPlatformAdmin = profile.is_platform_admin === true;

    if (!isOrgAdmin && !isPlatformAdmin) {
      console.error("[Logo Upload] User is not admin:", { role: profile.role });
      return new Response(
        JSON.stringify({
          error: "Forbidden",
          details: "Only organisation admins can upload logos. Your role: " + profile.role
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (profile.organisation_id !== organisationId && !isPlatformAdmin) {
      console.error("[Logo Upload] Org mismatch:", {
        userOrg: profile.organisation_id,
        targetOrg: organisationId
      });
      return new Response(
        JSON.stringify({
          error: "Forbidden",
          details: "Cannot upload logo for a different organisation"
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({
          error: "Invalid file type",
          details: "Only PNG, JPG, and SVG are allowed"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate file size
    const maxSize = 1024 * 1024;
    if (file.size > maxSize) {
      return new Response(
        JSON.stringify({
          error: "File too large",
          details: "Maximum size is 1MB"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prepare file upload
    const fileExt = file.name.split(".").pop();
    const fileName = `logo.${fileExt}`;
    const filePath = `org-logos/${organisationId}/${fileName}`;

    console.log("[Logo Upload] Uploading:", filePath);

    const fileBuffer = await file.arrayBuffer();

    // Upload to storage using admin client
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("org-assets")
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("[Logo Upload] Storage error:", uploadError.message);
      return new Response(
        JSON.stringify({
          error: "Storage upload failed",
          details: uploadError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("[Logo Upload] Storage success");

    // Update organisation record using admin client
    const { error: updateError } = await supabaseAdmin
      .from("organisations")
      .update({
        branding_logo_path: filePath,
        branding_updated_at: new Date().toISOString(),
      })
      .eq("id", organisationId);

    if (updateError) {
      console.error("[Logo Upload] DB update error:", updateError.message);
      return new Response(
        JSON.stringify({
          error: "Failed to update organisation",
          details: updateError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("[Logo Upload] Success");

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
