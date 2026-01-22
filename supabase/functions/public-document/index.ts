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
  label: string | null;
}

interface Document {
  id: string;
  title: string;
  document_type: string;
  version_number: number;
  issue_date: string;
  issue_status: string;
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
        JSON.stringify({
          error: "This link has been revoked",
          status: "revoked"
        }),
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
        JSON.stringify({
          error: "This link has expired",
          status: "expired",
          expired_at: link.expires_at
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: latestIssued, error: docError } = await supabase
      .from("documents")
      .select("id, title, document_type, version_number, issue_date, issue_status, locked_pdf_path")
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
        JSON.stringify({
          error: "No issued document available",
          status: "no_issued_document"
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const document = latestIssued as Document;

    await supabase
      .from("document_access_links")
      .update({
        last_accessed_at: new Date().toISOString(),
        access_count: link.access_count + 1,
      })
      .eq("id", link.id);

    const response = {
      document_id: document.id,
      title: document.title,
      document_type: document.document_type,
      version_number: document.version_number,
      issue_date: document.issue_date,
      locked_pdf_path: document.locked_pdf_path,
      has_pdf: !!document.locked_pdf_path,
      label: link.label,
    };

    return new Response(
      JSON.stringify(response),
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
