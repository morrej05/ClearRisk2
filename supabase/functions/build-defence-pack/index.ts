import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Document {
  id: string;
  organisation_id: string;
  base_document_id: string;
  title: string;
  document_type: string;
  version_number: number;
  issue_status: string;
  issue_date: string;
  locked_pdf_path: string | null;
}

interface ChangeSummary {
  summary_markdown: string | null;
  summary_json: any | null;
}

interface Action {
  id: string;
  priority: string;
  status: string;
  recommended_action: string;
  owner_name: string | null;
  target_date: string | null;
  module_code: string | null;
  created_at: string;
  reference_number: string | null;
}

interface Evidence {
  filename: string;
  size_bytes: number;
  content_type: string;
  uploaded_at: string;
  notes: string | null;
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { document_id } = await req.json();

    if (!document_id) {
      return new Response(
        JSON.stringify({ error: "Missing document_id parameter" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: existingPack } = await supabase
      .from("document_defence_packs")
      .select("*")
      .eq("document_id", document_id)
      .maybeSingle();

    if (existingPack) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Defence pack already exists",
          pack: existingPack,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", document_id)
      .maybeSingle();

    if (docError || !document) {
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const doc = document as Document;

    if (doc.issue_status !== "issued") {
      return new Response(
        JSON.stringify({
          error: "Document must be issued to generate defence pack",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!doc.locked_pdf_path) {
      return new Response(
        JSON.stringify({
          error: "Document must have a locked PDF to generate defence pack",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const zip = new JSZip();

    const { data: pdfData, error: pdfError } = await supabase.storage
      .from("locked-pdfs")
      .download(doc.locked_pdf_path);

    if (pdfError || !pdfData) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch locked PDF" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const pdfBytes = await pdfData.arrayBuffer();
    zip.file("issued_document.pdf", pdfBytes);

    const { data: changeSummary } = await supabase
      .from("document_change_summaries")
      .select("summary_markdown, summary_json")
      .eq("document_id", document_id)
      .maybeSingle();

    if (changeSummary) {
      const summary = changeSummary as ChangeSummary;
      if (summary.summary_markdown) {
        zip.file("change_summary.md", summary.summary_markdown);
      }
      if (summary.summary_json) {
        zip.file("change_summary.json", JSON.stringify(summary.summary_json, null, 2));
      }
    } else {
      zip.file("change_summary.txt", "Initial issue – no previous version.");
    }

    const { data: actions } = await supabase
      .from("actions")
      .select(`
        id,
        priority,
        status,
        recommended_action,
        target_date,
        module_code,
        created_at,
        reference_number,
        owner:owner_id(full_name)
      `)
      .eq("document_id", document_id)
      .order("created_at", { ascending: false });

    const actionsList = (actions || []).map((a: any) => ({
      id: a.id,
      reference_number: a.reference_number || "N/A",
      priority: a.priority || "N/A",
      status: a.status || "N/A",
      recommended_action: a.recommended_action || "N/A",
      owner_name: a.owner?.full_name || "Unassigned",
      target_date: a.target_date || "N/A",
      module_code: a.module_code || "N/A",
      created_at: a.created_at || "N/A",
    }));

    const actionsCSV = generateCSV(actionsList, [
      "reference_number",
      "priority",
      "status",
      "recommended_action",
      "owner_name",
      "target_date",
      "module_code",
      "created_at",
    ]);

    zip.file("actions_snapshot.csv", actionsCSV);
    zip.file("actions_snapshot.json", JSON.stringify(actionsList, null, 2));

    const { data: evidenceList } = await supabase
      .from("attachments")
      .select("filename, size_bytes, content_type, uploaded_at, notes")
      .eq("document_id", document_id)
      .order("uploaded_at", { ascending: false });

    const evidenceData = (evidenceList || []).map((e: any) => ({
      filename: e.filename || "Unknown",
      size_bytes: e.size_bytes || 0,
      content_type: e.content_type || "Unknown",
      uploaded_at: e.uploaded_at || "N/A",
      notes: e.notes || "",
    }));

    const evidenceCSV = generateCSV(evidenceData, [
      "filename",
      "size_bytes",
      "content_type",
      "uploaded_at",
      "notes",
    ]);

    zip.file("evidence_index.csv", evidenceCSV);
    zip.file("evidence_index.json", JSON.stringify(evidenceData, null, 2));

    const manifest = {
      document_id: doc.id,
      base_document_id: doc.base_document_id,
      title: doc.title,
      document_type: doc.document_type,
      version_number: doc.version_number,
      issue_date: doc.issue_date,
      pack_created_at: new Date().toISOString(),
      files: [
        { name: "issued_document.pdf", type: "Locked PDF" },
        { name: "change_summary.md", type: "Change Summary (Markdown)" },
        { name: "change_summary.json", type: "Change Summary (JSON)" },
        { name: "actions_snapshot.csv", type: "Action Register Snapshot (CSV)" },
        { name: "actions_snapshot.json", type: "Action Register Snapshot (JSON)" },
        { name: "evidence_index.csv", type: "Evidence Index (CSV)" },
        { name: "evidence_index.json", type: "Evidence Index (JSON)" },
      ],
      action_count: actionsList.length,
      evidence_count: evidenceData.length,
    };

    zip.file("manifest.json", JSON.stringify(manifest, null, 2));

    const zipBlob = await zip.generateAsync({ type: "uint8array" });

    const bundlePath = `org/${doc.organisation_id}/documents/${doc.id}/defence_pack_v${doc.version_number}.zip`;

    const { error: uploadError } = await supabase.storage
      .from("defence-packs")
      .upload(bundlePath, zipBlob, {
        contentType: "application/zip",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload defence pack" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const checksum = await generateChecksum(zipBlob);

    const token = authHeader.replace("Bearer ", "");
    const userSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: user } = await userSupabase.auth.getUser(token);

    const { data: pack, error: packError } = await supabase
      .from("document_defence_packs")
      .insert({
        organisation_id: doc.organisation_id,
        document_id: doc.id,
        base_document_id: doc.base_document_id,
        version_number: doc.version_number,
        created_by: user?.user?.id || null,
        bundle_path: bundlePath,
        checksum,
        size_bytes: zipBlob.length,
        manifest,
      })
      .select()
      .single();

    if (packError) {
      console.error("Pack record error:", packError);
      return new Response(
        JSON.stringify({ error: "Failed to record defence pack" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Defence pack created successfully",
        pack,
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
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generateCSV(data: any[], columns: string[]): string {
  if (data.length === 0) {
    return columns.join(",") + "\n";
  }

  const headers = columns.join(",");
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value = row[col]?.toString() || "";
        return value.includes(",") || value.includes('"') || value.includes("\n")
          ? `"${value.replace(/"/g, '""')}"`
          : value;
      })
      .join(",")
  );

  return [headers, ...rows].join("\n");
}

async function generateChecksum(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
