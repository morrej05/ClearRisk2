import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  document_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("[get-locked-pdf-url] Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body: RequestBody = await req.json();
    const { document_id } = body;

    if (!document_id) {
      return new Response(
        JSON.stringify({ error: "Missing document_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[get-locked-pdf-url] User ${user.id} requesting PDF for document ${document_id}`);

    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("organisation_id, locked_pdf_path, issue_status")
      .eq("id", document_id)
      .maybeSingle();

    if (docError) {
      console.error("[get-locked-pdf-url] Error fetching document:", docError);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!document) {
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!document.locked_pdf_path) {
      return new Response(
        JSON.stringify({ error: "No locked PDF available for this document" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: membership, error: membershipError } = await supabase
      .from("organisation_members")
      .select("role")
      .eq("organisation_id", document.organisation_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      console.error("[get-locked-pdf-url] Error checking membership:", membershipError);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!membership) {
      console.log(`[get-locked-pdf-url] User ${user.id} not a member of organisation ${document.organisation_id}`);
      return new Response(
        JSON.stringify({ error: "Access denied: not a member of this organisation" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[get-locked-pdf-url] Creating signed URL for path: ${document.locked_pdf_path}`);

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("document-pdfs")
      .createSignedUrl(document.locked_pdf_path, 600);

    if (signedUrlError) {
      console.error("[get-locked-pdf-url] Error creating signed URL:", signedUrlError);
      return new Response(
        JSON.stringify({ error: "Failed to create signed URL" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!signedUrlData?.signedUrl) {
      return new Response(
        JSON.stringify({ error: "Failed to generate signed URL" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[get-locked-pdf-url] Success! Signed URL created for user ${user.id}`);

    return new Response(
      JSON.stringify({ signed_url: signedUrlData.signedUrl }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[get-locked-pdf-url] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
