import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json();
    const { survey_report_id, document_id } = body;
    const targetId = survey_report_id || document_id;

    if (!targetId) {
      return new Response(
        JSON.stringify({ error: "survey_report_id or document_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("[generate-issued-pdf] Processing request for ID:", targetId);

    // Try to find in documents table first
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, locked_pdf_path, issue_status, organisation_id")
      .eq("id", targetId)
      .maybeSingle();

    if (document) {
      console.log("[generate-issued-pdf] Found document:", document.id, "status:", document.issue_status);

      // Verify document is issued
      if (document.issue_status !== "issued") {
        return new Response(
          JSON.stringify({
            error: "Document must be issued before generating locked PDF",
            current_status: document.issue_status
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Check if locked_pdf_path exists
      if (!document.locked_pdf_path) {
        return new Response(
          JSON.stringify({
            error: "No locked PDF found for this document. PDF may still be generating.",
            message: "Please wait a moment and try again, or generate the PDF manually."
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Generate signed URL for the locked PDF
      const { data: signedData, error: signedError } = await supabase.storage
        .from("document-pdfs")
        .createSignedUrl(document.locked_pdf_path, 3600); // 1 hour expiry

      if (signedError || !signedData) {
        console.error("[generate-issued-pdf] Error creating signed URL:", signedError);
        return new Response(
          JSON.stringify({
            error: "Failed to generate PDF signed URL",
            details: signedError?.message
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log("[generate-issued-pdf] Generated signed URL successfully");

      return new Response(
        JSON.stringify({
          success: true,
          signed_url: signedData.signedUrl,
          pdf_path: document.locked_pdf_path,
          expires_in: 3600,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Try survey_reports table
    const { data: survey, error: surveyError } = await supabase
      .from("survey_reports")
      .select("id, locked_pdf_path, status, organisation_id")
      .eq("id", targetId)
      .maybeSingle();

    if (survey) {
      console.log("[generate-issued-pdf] Found survey:", survey.id, "status:", survey.status);

      // Verify survey is issued
      if (survey.status !== "issued") {
        return new Response(
          JSON.stringify({
            error: "Survey must be issued before generating locked PDF",
            current_status: survey.status
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Check if locked_pdf_path exists
      if (!survey.locked_pdf_path) {
        return new Response(
          JSON.stringify({
            error: "No locked PDF found for this survey. PDF may still be generating.",
            message: "Please wait a moment and try again, or generate the PDF manually."
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Generate signed URL for the locked PDF
      const { data: signedData, error: signedError } = await supabase.storage
        .from("survey-pdfs")
        .createSignedUrl(survey.locked_pdf_path, 3600); // 1 hour expiry

      if (signedError || !signedData) {
        console.error("[generate-issued-pdf] Error creating signed URL:", signedError);
        return new Response(
          JSON.stringify({
            error: "Failed to generate PDF signed URL",
            details: signedError?.message
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log("[generate-issued-pdf] Generated signed URL successfully");

      return new Response(
        JSON.stringify({
          success: true,
          signed_url: signedData.signedUrl,
          pdf_path: survey.locked_pdf_path,
          expires_in: 3600,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Not found in either table
    return new Response(
      JSON.stringify({
        error: "Document or survey not found",
        id: targetId
      }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("[generate-issued-pdf] Error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
