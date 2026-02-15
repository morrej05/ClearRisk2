// src/lib/fra/severityEngine.ts

export type FraPriority = "P1" | "P2" | "P3" | "P4";
export type FraSeverityTier = "T1" | "T2" | "T3" | "T4";

export type FraFindingCategory =
  | "MeansOfEscape"
  | "DetectionAlarm"
  | "EmergencyLighting"
  | "Compartmentation"
  | "FireDoors"
  | "FireFighting"
  | "Management"
  | "Housekeeping"
  | "Other";

export type FraOccupancyRisk = "NonSleeping" | "Sleeping" | "Vulnerable";

export interface FraContext {
  occupancyRisk: FraOccupancyRisk;
  storeys?: number | null;
  // add anything else you already have centrally (e.g. building count, etc.)
}

export interface FraActionInput {
  category: FraFindingCategory;
  // structured facts - keep minimal and objective
  finalExitObstructed?: boolean;
  finalExitLocked?: boolean;
  singleStairCompromised?: boolean;
  noFireDetection?: boolean;
  detectionInadequateCoverage?: boolean;
  noEmergencyLighting?: boolean;
  seriousCompartmentationFailure?: boolean;
  highRiskRoomToEscapeRoute?: boolean;
  noFraEvidenceOrReview?: boolean;

  // fallbacks
  assessorMarkedCritical?: boolean; // only allowed to UP-rate with justification in UI
}

/**
 * Returns Tier (T1..T4) using deterministic, defensible trigger rules.
 * No Likelihood x Impact.
 */
export function deriveSeverityTier(
  action: FraActionInput,
  ctx: FraContext
): FraSeverityTier {
  const sleepingOrVulnerable =
    ctx.occupancyRisk === "Sleeping" || ctx.occupancyRisk === "Vulnerable";

  // --- T4 (Material Life Safety Risk) -> P1 ---
  // Final exits / escape integrity
  if (action.finalExitLocked || action.finalExitObstructed) return "T4";

  // Detection absent in sleeping / vulnerable premises
  if (sleepingOrVulnerable && action.noFireDetection) return "T4";

  // Emergency lighting absent in multi-storey
  if ((ctx.storeys ?? 0) >= 2 && action.noEmergencyLighting) return "T4";

  // Single stair compromised above low-rise
  if ((ctx.storeys ?? 0) >= 4 && action.singleStairCompromised) return "T4";

  // Severe compartmentation failure where escape relies on it
  if (sleepingOrVulnerable && action.seriousCompartmentationFailure) return "T4";

  // High-risk room opening onto escape route without protection (simple flag)
  if (action.highRiskRoomToEscapeRoute) return "T4";

  // No FRA evidence/review in complex building could be escalated, but keep as T3 unless you want hard T4
  // if (action.noFraEvidenceOrReview && (ctx.storeys ?? 0) >= 4) return "T4";

  // --- T3 (Significant Deficiency) -> P2 ---
  if (action.noFireDetection) return "T3"; // non-sleeping: still serious
  if (action.detectionInadequateCoverage) return "T3";
  if (action.seriousCompartmentationFailure) return "T3";
  if (action.singleStairCompromised) return "T3";
  if (action.noFraEvidenceOrReview) return "T3";

  // --- T2 (Improvement Required) -> P3 ---
  // Use category-based defaults if no explicit hard trigger flags were set.
  if (
    action.category === "Management" ||
    action.category === "Housekeeping" ||
    action.category === "FireFighting"
  ) {
    return "T2";
  }

  // --- T1 (Minor) -> P4 ---
  return "T1";
}

export function mapTierToPriority(tier: FraSeverityTier): FraPriority {
  switch (tier) {
    case "T4":
      return "P1";
    case "T3":
      return "P2";
    case "T2":
      return "P3";
    case "T1":
    default:
      return "P4";
  }
}

export interface MaterialDeficiencyCheckResult {
  isMaterialDeficiency: boolean;
  triggers: string[];
}

/**
 * Use this to drive: executive summary escalation language, banners, etc.
 */
export function checkMaterialDeficiency(
  actions: Array<{ priority?: FraPriority; severityTier?: FraSeverityTier }>,
  ctx: FraContext
): MaterialDeficiencyCheckResult {
  const triggers: string[] = [];
  const anyP1 =
    actions.some((a) => a.priority === "P1" || a.severityTier === "T4") ?? false;

  if (anyP1) triggers.push("One or more actions classified as P1 (Material Life Safety Risk).");

  // Optional: extra rule examples
  if (ctx.occupancyRisk === "Vulnerable" && anyP1) {
    triggers.push("Vulnerable occupants increase the criticality of life safety deficiencies.");
  }

  return { isMaterialDeficiency: triggers.length > 0, triggers };
}

// Executive outcome is qualitative, not numeric.
export type FraExecutiveOutcome =
  | "SatisfactoryWithImprovements"
  | "ImprovementsRequired"
  | "SignificantDeficiencies"
  | "MaterialLifeSafetyRiskPresent";

export function deriveExecutiveOutcome(
  actions: Array<{ priority?: FraPriority; severityTier?: FraSeverityTier }>
): FraExecutiveOutcome {
  const p1 = actions.filter((a) => a.priority === "P1" || a.severityTier === "T4").length;
  const p2 = actions.filter((a) => a.priority === "P2" || a.severityTier === "T3").length;

  if (p1 >= 1) return "MaterialLifeSafetyRiskPresent";
  if (p2 >= 3) return "SignificantDeficiencies";
  if (p2 >= 1) return "ImprovementsRequired";
  return "SatisfactoryWithImprovements";
}
