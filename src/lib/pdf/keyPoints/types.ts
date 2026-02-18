/**
 * Types for deterministic Key Points engine
 *
 * Provides structured output with evidence trails for each fired sentence,
 * enabling reproducible PDF generation and future traceability.
 */

/**
 * A single fired sentence with its evidence trail
 */
export interface FiredSentence {
  /** Unique rule identifier that generated this sentence */
  ruleId: string;

  /** Sentence type for prioritization */
  type: 'weakness' | 'strength' | 'info';

  /** Weight for sorting (higher = more important) */
  weight: number;

  /** The final rendered sentence text */
  text: string;

  /** Evidence trail: field paths and values that triggered this rule */
  evidence: Array<{
    /** Field path in module data (e.g., 'electrical_safety.eicr_satisfactory') */
    field: string;
    /** Value that satisfied the rule condition */
    value: any;
  }>;
}

/**
 * Complete section evaluation with provisional status
 */
export interface SectionEvaluation {
  /** Section identifier (5-12 for FRA) */
  sectionId: number;

  /** Human-readable summary line (e.g., "3 weaknesses, 1 strength identified") */
  summary: string;

  /** All fired sentences (sorted, deduped, limited to top 4) */
  fired: FiredSentence[];

  /** Provisional flag: true if any significant unknowns/gaps remain */
  provisional: boolean;

  /** List of info gap reasons (for "Assessment notes" box) */
  infoGapReasons: string[];
}

/**
 * Evaluation context passed to rule engine
 */
export interface EvaluationContext {
  /** Merged module data from all modules in section */
  data: Record<string, any>;

  /** Original module instances for metadata access */
  modules: Array<{
    id: string;
    module_key: string;
    data: Record<string, any>;
    outcome: string | null;
  }>;

  /** Actions linked to this section */
  actions: Array<{
    id: string;
    recommended_action: string;
    priority_band: string;
    status: string;
  }>;
}
