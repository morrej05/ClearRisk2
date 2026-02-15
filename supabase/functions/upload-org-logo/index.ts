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

    console.log("[Logo Upload] Authorization header check:", {
      hasAuthHeader: !!authHeader,
      authHeaderPrefix: authHeader?.substring(0, 20) + "...",
    });

    if (!authHeader) {
      console.error("[Logo Upload] Missing Authorization header");
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!authHeader.startsWith("Bearer ")) {
      console.error("[Logo Upload] Invalid Authorization header format");
      return new Response(
        JSON.stringify({ error: "Invalid Authorization header format" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    console.log("[Logo Upload] Getting user from token...");

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError) {
      console.error("[Logo Upload] User authentication error:", {
        message: userError.message,
        status: userError.status,
      });
      return new Response(
        JSON.stringify({ error: `Authentication failed: ${userError.message}` }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!user) {
      console.error("[Logo Upload] No user found from token");
      return new Response(
        JSON.stringify({ error: "Unauthorized - no user found" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("[Logo Upload] User authenticated:", {
      userId: user.id,
      email: user.email,
    });

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

    console.log("[Logo Upload] Uploading to storage:", {
      bucket: "org-assets",
      filePath,
      contentType: file.type,
      fileSize: file.size,
      orgId,
    });

    const fileBuffer = await file.arrayBuffer();

    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from("org-assets")
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("[Logo Upload] Storage upload error:", {
        message: uploadError.message,
        statusCode: uploadError.statusCode,
        error: uploadError,
      });
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    console.log("[Logo Upload] Storage upload successful:", uploadData);

    console.log("[Logo Upload] Updating organisation record:", {
      orgId,
      branding_logo_path: filePath,
    });

    const { data: updateData, error: updateError } = await supabaseClient
      .from("organisations")
      .update({
        branding_logo_path: filePath,
        branding_updated_at: new Date().toISOString(),
      })
      .eq("id", orgId);

    if (updateError) {
      console.error("[Logo Upload] Organisation update error:", {
        message: updateError.message,
        code: updateError.code,
        details: updateError.details,
        error: updateError,
      });
      throw new Error(`Failed to update organisation: ${updateError.message}`);
    }

    console.log("[Logo Upload] Organisation updated successfully:", updateData);

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
