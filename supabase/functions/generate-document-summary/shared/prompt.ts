export const EXEC_SUMMARY_SCHEMA_VERSION = 1;

export type SummaryStyle = "executive" | "client" | "technical";

export interface SummaryGenerationPayload {
  style: SummaryStyle;
  document: {
    id: string;
    documentType: string;
    title: string | null;
    assessmentDate: string | null;
    scopeDescription: string | null;
    limitationsAssumptions: string | null;
  };
  moduleOutcomes: {
    totalModules: number;
    compliant: number;
    minorDef: number;
    materialDef: number;
    infoGap: number;
  };
  actionStats: {
    totalOpenActions: number;
    p1: number;
    p2: number;
    p3: number;
    p4: number;
    sampleActions: Array<{
      moduleCode: string | null;
      priority: string | null;
      recommendedAction: string;
    }>;
  };
}

export function buildSystemPrompt(): string {
  return [
    "You are a fire risk engineering assistant producing concise executive summaries.",
    "You MUST use only the provided JSON payload.",
    "Do not invent facts, regulations, standards, site details, or recommendations beyond the payload.",
    "Return strictly valid JSON matching the provided schema.",
    "Keep language factual, neutral, and suitable for professional reports.",
  ].join(" ");
}

export function buildUserPrompt(payload: SummaryGenerationPayload): string {
  return [
    "Generate an executive summary object for an FRA document.",
    "The field `narrative` must be 120-220 words and must align with counts and findings in the payload.",
    "`key_findings` must contain 3-6 short factual bullets.",
    "`headline` must be a single concise sentence.",
    "Input payload:",
    JSON.stringify(payload),
  ].join("\n\n");
}

export function buildSummaryJsonSchema() {
  return {
    name: "executive_summary_json",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: [
        "schema_version",
        "style",
        "headline",
        "overall_assessment",
        "key_findings",
        "priorities",
        "module_outcomes",
        "scope",
        "narrative",
      ],
      properties: {
        schema_version: {
          type: "integer",
          const: EXEC_SUMMARY_SCHEMA_VERSION,
        },
        style: {
          type: "string",
          enum: ["executive", "client", "technical"],
        },
        headline: {
          type: "string",
          minLength: 10,
          maxLength: 220,
        },
        overall_assessment: {
          type: "string",
          minLength: 10,
          maxLength: 500,
        },
        key_findings: {
          type: "array",
          minItems: 3,
          maxItems: 6,
          items: {
            type: "string",
            minLength: 5,
            maxLength: 240,
          },
        },
        priorities: {
          type: "object",
          additionalProperties: false,
          required: ["total_open_actions", "p1", "p2", "p3", "p4"],
          properties: {
            total_open_actions: { type: "integer", minimum: 0 },
            p1: { type: "integer", minimum: 0 },
            p2: { type: "integer", minimum: 0 },
            p3: { type: "integer", minimum: 0 },
            p4: { type: "integer", minimum: 0 },
          },
        },
        module_outcomes: {
          type: "object",
          additionalProperties: false,
          required: ["total_modules", "compliant", "minor_def", "material_def", "info_gap"],
          properties: {
            total_modules: { type: "integer", minimum: 0 },
            compliant: { type: "integer", minimum: 0 },
            minor_def: { type: "integer", minimum: 0 },
            material_def: { type: "integer", minimum: 0 },
            info_gap: { type: "integer", minimum: 0 },
          },
        },
        scope: {
          type: "object",
          additionalProperties: false,
          required: [
            "document_id",
            "document_type",
            "title",
            "assessment_date",
            "scope_description",
            "limitations_assumptions",
          ],
          properties: {
            document_id: { type: "string", minLength: 1 },
            document_type: { type: "string", minLength: 1 },
            title: { type: ["string", "null"], maxLength: 260 },
            assessment_date: { type: ["string", "null"], maxLength: 80 },
            scope_description: { type: ["string", "null"], maxLength: 600 },
            limitations_assumptions: { type: ["string", "null"], maxLength: 600 },
          },
        },
        narrative: {
          type: "string",
          minLength: 120,
          maxLength: 1800,
        },
      },
    },
  };
}
