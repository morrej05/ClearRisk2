import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  buildSummaryJsonSchema,
  buildSystemPrompt,
  buildUserPrompt,
  EXEC_SUMMARY_SCHEMA_VERSION,
  type SummaryGenerationPayload,
  type SummaryStyle,
} from "./shared/prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_MODULE_ROWS = 300;
const MAX_ACTION_ROWS = 120;
const MAX_ACTION_SAMPLES = 20;
const INPUT_TEXT_LIMIT = 1200;
const OPENAI_MAX_RETRIES = 3;

interface GenerateDocumentSummaryRequest {
  documentId: string;
  documentVersionId?: string;
  versionId?: string;
  style?: SummaryStyle;
  dryRun?: boolean;
}

interface DocumentRow {
  id: string;
  organisation_id: string;
  document_type: string;
  issue_status: string;
  title: string | null;
  assessment_date: string | null;
  scope_description: string | null;
  limitations_assumptions: string | null;
  executive_summary_author?: string | null;
}

interface ModuleInstanceRow {
  module_key: string | null;
  outcome: string | null;
}

interface ActionRow {
  module_code: string | null;
  priority: string | null;
  recommended_action: string | null;
}

interface ExecutiveSummaryJson {
  schema_version: number;
  style: SummaryStyle;
  headline: string;
  overall_assessment: string;
  key_findings: string[];
  priorities: {
    total_open_actions: number;
    p1: number;
    p2: number;
    p3: number;
    p4: number;
  };
  module_outcomes: {
    total_modules: number;
    compliant: number;
    minor_def: number;
    material_def: number;
    info_gap: number;
  };
  scope: {
    document_id: string;
    document_type: string;
    title: string | null;
    assessment_date: string | null;
    scope_description: string | null;
    limitations_assumptions: string | null;
  };
  narrative: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(401, { error: "Authorization header required" });
    }

    const body = (await req.json()) as Partial<GenerateDocumentSummaryRequest>;
    const parsedRequest = validateRequest(body);
    if (!parsedRequest.valid) {
      return jsonResponse(400, { error: parsedRequest.error });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!supabaseUrl || !anonKey) {
      return jsonResponse(500, { error: "Supabase configuration missing" });
    }
    if (!openaiApiKey) {
      return jsonResponse(500, { error: "OpenAI API key not configured" });
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse(401, { error: "Unauthorized" });
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("organisation_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile?.organisation_id) {
      return jsonResponse(403, { error: "User organisation not found" });
    }

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select(
        "id, organisation_id, document_type, issue_status, title, assessment_date, scope_description, limitations_assumptions, executive_summary_author"
      )
      .eq("id", parsedRequest.value.documentId)
      .eq("organisation_id", profile.organisation_id)
      .maybeSingle<DocumentRow>();

    if (documentError) {
      console.error("Failed to load document", documentError);
      return jsonResponse(500, { error: "Failed to load document" });
    }

    if (!document) {
      return jsonResponse(404, { error: "Document not found or access denied" });
    }

    if (document.document_type !== "FRA") {
      return jsonResponse(400, { error: "Only FRA documents are currently supported" });
    }

    if (document.issue_status !== "draft") {
      return jsonResponse(400, { error: "Document must be in draft status" });
    }

    const { data: modules, error: modulesError } = await supabase
      .from("module_instances")
      .select("module_key, outcome")
      .eq("document_id", document.id)
      .limit(MAX_MODULE_ROWS);

    if (modulesError) {
      console.error("Failed to load module outcomes", modulesError);
      return jsonResponse(500, { error: "Failed to load module data" });
    }

    const { data: actions, error: actionsError } = await supabase
      .from("actions")
      .select("module_code, priority, recommended_action")
      .eq("document_id", document.id)
      .eq("status", "open")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(MAX_ACTION_ROWS);

    if (actionsError) {
      console.error("Failed to load actions", actionsError);
      return jsonResponse(500, { error: "Failed to load action data" });
    }

    const payload = buildPayload(
      parsedRequest.value.style,
      document,
      (modules ?? []) as ModuleInstanceRow[],
      (actions ?? []) as ActionRow[]
    );

    const aiSummary = await generateAiSummary(openaiApiKey, payload);

    if (!parsedRequest.value.dryRun) {
      const updatePayload: Record<string, unknown> = {
        executive_summary_ai: JSON.stringify(aiSummary),
        executive_summary_mode: "ai",
        updated_at: new Date().toISOString(),
      };

      if (Object.prototype.hasOwnProperty.call(document, "executive_summary_author")) {
        updatePayload.executive_summary_author = document.executive_summary_author ?? null;
      }

      const { error: updateError } = await supabase
        .from("documents")
        .update(updatePayload)
        .eq("id", document.id)
        .eq("organisation_id", profile.organisation_id);

      if (updateError) {
        console.error("Failed to save executive summary", updateError);
        return jsonResponse(500, { error: "Failed to persist executive summary" });
      }
    }

    return jsonResponse(200, {
      success: true,
      documentId: document.id,
      style: parsedRequest.value.style,
      dryRun: parsedRequest.value.dryRun,
      summary: aiSummary,
    });
  } catch (error) {
    console.error("Error in generate-document-summary", error);
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Internal server error" });
  }
});

function validateRequest(body: Partial<GenerateDocumentSummaryRequest>):
  | { valid: true; value: Required<Pick<GenerateDocumentSummaryRequest, "documentId" | "style" | "dryRun">> & Pick<GenerateDocumentSummaryRequest, "documentVersionId" | "versionId"> }
  | { valid: false; error: string } {
  if (!body.documentId || typeof body.documentId !== "string") {
    return { valid: false, error: "documentId is required" };
  }

  const documentVersionId = typeof body.documentVersionId === "string" ? body.documentVersionId : undefined;
  const versionId = typeof body.versionId === "string" ? body.versionId : undefined;

  if (documentVersionId && versionId && documentVersionId !== versionId) {
    return { valid: false, error: "documentVersionId and versionId must match when both are supplied" };
  }

  const style: SummaryStyle =
    body.style === "client" || body.style === "technical" || body.style === "executive"
      ? body.style
      : "executive";

  return {
    valid: true,
    value: {
      documentId: body.documentId,
      documentVersionId,
      versionId,
      style,
      dryRun: body.dryRun === true,
    },
  };
}

function buildPayload(
  style: SummaryStyle,
  document: DocumentRow,
  modules: ModuleInstanceRow[],
  actions: ActionRow[]
): SummaryGenerationPayload {
  const moduleOutcomes = {
    totalModules: modules.length,
    compliant: countModules(modules, "compliant"),
    minorDef: countModules(modules, "minor_def"),
    materialDef: countModules(modules, "material_def"),
    infoGap: countModules(modules, "info_gap"),
  };

  const actionStats = {
    totalOpenActions: actions.length,
    p1: countActions(actions, "P1"),
    p2: countActions(actions, "P2"),
    p3: countActions(actions, "P3"),
    p4: countActions(actions, "P4"),
    sampleActions: actions.slice(0, MAX_ACTION_SAMPLES).map((action) => ({
      moduleCode: action.module_code,
      priority: action.priority,
      recommendedAction: trimText(action.recommended_action ?? "", 220),
    })),
  };

  return {
    style,
    document: {
      id: document.id,
      documentType: document.document_type,
      title: trimNullable(document.title, 260),
      assessmentDate: trimNullable(document.assessment_date, 80),
      scopeDescription: trimNullable(document.scope_description, INPUT_TEXT_LIMIT),
      limitationsAssumptions: trimNullable(document.limitations_assumptions, INPUT_TEXT_LIMIT),
    },
    moduleOutcomes,
    actionStats,
  };
}

async function generateAiSummary(
  openaiApiKey: string,
  payload: SummaryGenerationPayload
): Promise<ExecutiveSummaryJson> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(payload);

  const openaiData = await fetchWithRetry(openaiApiKey, {
    model: "gpt-4o-mini",
    temperature: 0.2,
    max_tokens: 1200,
    response_format: {
      type: "json_schema",
      json_schema: buildSummaryJsonSchema(),
    },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = openaiData?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("OpenAI did not return summary content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("OpenAI returned invalid JSON");
  }

  return validateAiSummary(parsed);
}

async function fetchWithRetry(openaiApiKey: string, body: Record<string, unknown>) {
  let lastErrorText = "";

  for (let attempt = 1; attempt <= OPENAI_MAX_RETRIES; attempt += 1) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      return response.json();
    }

    lastErrorText = await response.text();
    const shouldRetry = response.status === 429 || response.status >= 500;

    if (!shouldRetry || attempt === OPENAI_MAX_RETRIES) {
      throw new Error(`OpenAI API error (${response.status}): ${lastErrorText}`);
    }

    await delay(250 * 2 ** (attempt - 1));
  }

  throw new Error(`OpenAI API failed: ${lastErrorText}`);
}

function validateAiSummary(parsed: unknown): ExecutiveSummaryJson {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Summary payload must be a JSON object");
  }

  const summary = parsed as Partial<ExecutiveSummaryJson>;

  if (summary.schema_version !== EXEC_SUMMARY_SCHEMA_VERSION) {
    throw new Error("Invalid summary schema version");
  }

  if (!summary.style || !["executive", "client", "technical"].includes(summary.style)) {
    throw new Error("Invalid summary style");
  }

  if (!summary.headline || !summary.overall_assessment || !summary.narrative) {
    throw new Error("Summary is missing required narrative fields");
  }

  if (!Array.isArray(summary.key_findings) || summary.key_findings.length < 3) {
    throw new Error("Summary key_findings are invalid");
  }

  if (!summary.priorities || !summary.module_outcomes || !summary.scope) {
    throw new Error("Summary is missing required sections");
  }

  return {
    schema_version: summary.schema_version,
    style: summary.style,
    headline: summary.headline,
    overall_assessment: summary.overall_assessment,
    key_findings: summary.key_findings,
    priorities: {
      total_open_actions: safeInt(summary.priorities.total_open_actions),
      p1: safeInt(summary.priorities.p1),
      p2: safeInt(summary.priorities.p2),
      p3: safeInt(summary.priorities.p3),
      p4: safeInt(summary.priorities.p4),
    },
    module_outcomes: {
      total_modules: safeInt(summary.module_outcomes.total_modules),
      compliant: safeInt(summary.module_outcomes.compliant),
      minor_def: safeInt(summary.module_outcomes.minor_def),
      material_def: safeInt(summary.module_outcomes.material_def),
      info_gap: safeInt(summary.module_outcomes.info_gap),
    },
    scope: {
      document_id: String(summary.scope.document_id ?? ""),
      document_type: String(summary.scope.document_type ?? ""),
      title: summary.scope.title ?? null,
      assessment_date: summary.scope.assessment_date ?? null,
      scope_description: summary.scope.scope_description ?? null,
      limitations_assumptions: summary.scope.limitations_assumptions ?? null,
    },
    narrative: summary.narrative,
  };
}

function countModules(modules: ModuleInstanceRow[], status: string): number {
  return modules.reduce((count, module) => count + (module.outcome === status ? 1 : 0), 0);
}

function countActions(actions: ActionRow[], priority: string): number {
  return actions.reduce((count, action) => count + (action.priority === priority ? 1 : 0), 0);
}

function trimNullable(value: string | null, maxLength: number): string | null {
  if (!value) {
    return null;
  }

  return trimText(value, maxLength);
}

function trimText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function safeInt(value: unknown): number {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0;
  }

  return Math.floor(numericValue);
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
