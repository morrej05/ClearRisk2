import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ModuleOutcome {
  module_key: string;
  outcome: string | null;
}

interface ActionCount {
  P1: number;
  P2: number;
  P3: number;
  P4: number;
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

    const { data: modules } = await supabase
      .from("module_instances")
      .select("module_key, outcome")
      .eq("document_id", document_id);

    const { data: actions } = await supabase
      .from("actions")
      .select("priority")
      .eq("document_id", document_id)
      .is("deleted_at", null);

    const actionCounts: ActionCount = { P1: 0, P2: 0, P3: 0, P4: 0 };
    (actions || []).forEach((action: any) => {
      if (action.priority in actionCounts) {
        actionCounts[action.priority as keyof ActionCount]++;
      }
    });

    const moduleOutcomes = (modules || []) as ModuleOutcome[];

    const summary = generateExecutiveSummary(
      document.document_type,
      document.title,
      document.scope_description,
      document.assessment_date,
      moduleOutcomes,
      actionCounts
    );

    const { error: updateError } = await supabase
      .from("documents")
      .update({
        executive_summary_ai: summary,
        updated_at: new Date().toISOString(),
      })
      .eq("id", document_id);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to save executive summary" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary,
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

function generateExecutiveSummary(
  documentType: string,
  title: string,
  scope: string | null,
  assessmentDate: string,
  modules: ModuleOutcome[],
  actionCounts: ActionCount
): string {
  const date = new Date(assessmentDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const totalActions = actionCounts.P1 + actionCounts.P2 + actionCounts.P3 + actionCounts.P4;

  const compliantCount = modules.filter((m) => m.outcome === "compliant").length;
  const minorDefCount = modules.filter((m) => m.outcome === "minor_def").length;
  const materialDefCount = modules.filter((m) => m.outcome === "material_def").length;
  const infoGapCount = modules.filter((m) => m.outcome === "info_gap").length;
  const totalModules = modules.length;

  let docTypeDescription = "";
  if (documentType === "FRA") {
    docTypeDescription = "fire risk assessment";
  } else if (documentType === "DSEAR") {
    docTypeDescription = "explosion risk assessment (DSEAR)";
  } else if (documentType === "FSD") {
    docTypeDescription = "fire safety design review";
  } else {
    docTypeDescription = "safety assessment";
  }

  let paragraphs: string[] = [];

  paragraphs.push(
    `This ${docTypeDescription} was conducted on ${date}${
      scope ? ` covering ${scope.toLowerCase()}` : ""
    }. The assessment examined ${totalModules} key areas of fire safety to identify hazards, evaluate controls, and determine necessary actions to ensure regulatory compliance and occupant safety.`
  );

  if (totalModules > 0) {
    let outcomeDescription = "";
    if (materialDefCount > 0) {
      outcomeDescription = `The assessment identified ${materialDefCount} area${
        materialDefCount > 1 ? "s" : ""
      } with material deficiencies requiring immediate attention`;
      if (minorDefCount > 0) {
        outcomeDescription += `, along with ${minorDefCount} area${
          minorDefCount > 1 ? "s" : ""
        } showing minor deficiencies`;
      }
      outcomeDescription += `.`;
    } else if (minorDefCount > 0) {
      outcomeDescription = `The assessment found ${minorDefCount} area${
        minorDefCount > 1 ? "s" : ""
      } with minor deficiencies that should be addressed to enhance safety standards.`;
    } else if (compliantCount === totalModules) {
      outcomeDescription = `All assessed areas were found to be compliant with current fire safety standards and regulations.`;
    } else {
      outcomeDescription = `The assessment identified a mixture of compliant and non-compliant areas across the premises.`;
    }

    paragraphs.push(outcomeDescription);
  }

  if (totalActions > 0) {
    let actionDescription = `A total of ${totalActions} recommendation${
      totalActions > 1 ? "s have" : " has"
    } been made`;

    const priorities: string[] = [];
    if (actionCounts.P1 > 0) {
      priorities.push(
        `${actionCounts.P1} high priority item${actionCounts.P1 > 1 ? "s" : ""} requiring immediate action`
      );
    }
    if (actionCounts.P2 > 0) {
      priorities.push(
        `${actionCounts.P2} medium-high priority item${actionCounts.P2 > 1 ? "s" : ""}`
      );
    }
    if (actionCounts.P3 > 0) {
      priorities.push(
        `${actionCounts.P3} medium priority item${actionCounts.P3 > 1 ? "s" : ""}`
      );
    }
    if (actionCounts.P4 > 0) {
      priorities.push(
        `${actionCounts.P4} lower priority improvement${actionCounts.P4 > 1 ? "s" : ""}`
      );
    }

    if (priorities.length > 0) {
      actionDescription += `, including ${priorities.join(", ")}`;
    }
    actionDescription += `.`;

    paragraphs.push(actionDescription);

    if (actionCounts.P1 > 0) {
      paragraphs.push(
        `The high priority recommendations should be implemented without delay to address significant fire safety concerns and reduce risk to acceptable levels. These actions are essential to ensuring the safety of occupants and compliance with fire safety legislation.`
      );
    } else {
      paragraphs.push(
        `Implementation of the recommended actions will enhance fire safety standards and ensure continued compliance with regulatory requirements. Priority should be given to higher-rated recommendations to address the most significant areas for improvement.`
      );
    }
  } else {
    paragraphs.push(
      `No specific recommendations have been made at this time. Continued maintenance of existing fire safety measures and regular review of arrangements are advised to ensure ongoing compliance.`
    );
  }

  paragraphs.push(
    `This executive summary provides an overview of the key findings. Full details of the assessment methodology, specific findings, and detailed recommendations are provided in the main body of this report.`
  );

  return paragraphs.join("\n\n");
}
