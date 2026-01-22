import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AccessLink {
  id: string;
  organisation_id: string;
  base_document_id: string;
  expires_at: string;
  revoked_at: string | null;
  access_count: number;
}

interface Document {
  id: string;
  title: string;
  locked_pdf_path: string | null;
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
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Missing token parameter" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: accessLink, error: linkError } = await supabase
      .from("document_access_links")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (linkError) {
      console.error("Error fetching access link:", linkError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired link" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!accessLink) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired link" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const link = accessLink as AccessLink;

    if (link.revoked_at) {
      return new Response(
        JSON.stringify({ error: "This link has been revoked" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const now = new Date();
    const expiresAt = new Date(link.expires_at);

    if (now > expiresAt) {
      return new Response(
        JSON.stringify({ error: "This link has expired" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: latestIssued, error: docError } = await supabase
      .from("documents")
      .select("id, title, locked_pdf_path")
      .eq("base_document_id", link.base_document_id)
      .eq("issue_status", "issued")
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (docError) {
      console.error("Error fetching document:", docError);
      return new Response(
        JSON.stringify({ error: "Error loading document" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!latestIssued) {
      return new Response(
        JSON.stringify({ error: "No issued document available" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const document = latestIssued as Document;

    if (!document.locked_pdf_path) {
      return new Response(
        JSON.stringify({
          error: "PDF not available for this document",
          message: "The document must be issued with a locked PDF"
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from("locked-pdfs")
      .createSignedUrl(document.locked_pdf_path, 300);

    if (signedUrlError || !signedUrlData) {
      console.error("Error creating signed URL:", signedUrlError);
      return new Response(
        JSON.stringify({ error: "Failed to generate download URL" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    await supabase
      .from("document_access_links")
      .update({
        last_accessed_at: new Date().toISOString(),
        access_count: link.access_count + 1,
      })
      .eq("id", link.id);

    return new Response(
      JSON.stringify({
        url: signedUrlData.signedUrl,
        expires_in: 300,
        filename: `${document.title}.pdf`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
