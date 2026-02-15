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

export interface FraSeverityResult {
  tier: FraSeverityTier;
  priority: FraPriority;
  triggerId: string;
  triggerText: string;
}

/**
 * Derives severity with full trigger context (ID + text explanation).
 * This is the primary function to use for new action creation/editing.
 */
export function deriveSeverity(
  action: FraActionInput,
  ctx: FraContext
): FraSeverityResult {
  const sleepingOrVulnerable =
    ctx.occupancyRisk === "Sleeping" || ctx.occupancyRisk === "Vulnerable";

  // P1 / T4 triggers (return immediately)
  if (action.finalExitLocked)
    return {
      tier: "T4",
      priority: "P1",
      triggerId: "MOE-P1-01",
      triggerText: "Final exit is locked or secured in a manner that may prevent escape."
    };

  if (action.finalExitObstructed)
    return {
      tier: "T4",
      priority: "P1",
      triggerId: "MOE-P1-02",
      triggerText: "Escape route or final exit is obstructed, potentially delaying evacuation."
    };

  if (sleepingOrVulnerable && action.noFireDetection)
    return {
      tier: "T4",
      priority: "P1",
      triggerId: "DA-P1-01",
      triggerText: "Sleeping premises with no suitable fire detection and warning system."
    };

  if ((ctx.storeys ?? 0) >= 2 && action.noEmergencyLighting)
    return {
      tier: "T4",
      priority: "P1",
      triggerId: "EL-P1-01",
      triggerText: "No effective emergency lighting where power failure could impair escape."
    };

  if ((ctx.storeys ?? 0) >= 4 && action.singleStairCompromised)
    return {
      tier: "T4",
      priority: "P1",
      triggerId: "MOE-P1-03",
      triggerText: "Single escape stair compromised in a building reliant on that stair for evacuation."
    };

  if (sleepingOrVulnerable && action.seriousCompartmentationFailure)
    return {
      tier: "T4",
      priority: "P1",
      triggerId: "COMP-P1-01",
      triggerText: "Significant compartmentation failures in sleeping premises affecting smoke/fire spread."
    };

  if (action.highRiskRoomToEscapeRoute)
    return {
      tier: "T4",
      priority: "P1",
      triggerId: "COMP-P1-03",
      triggerText: "High-risk room opens onto an escape route without suitable protection."
    };

  // P2 / T3 triggers
  if (action.noFireDetection)
    return {
      tier: "T3",
      priority: "P2",
      triggerId: "DA-P2-01",
      triggerText: "No suitable fire detection and warning system to provide timely warning."
    };

  if (action.detectionInadequateCoverage)
    return {
      tier: "T3",
      priority: "P2",
      triggerId: "DA-P2-02",
      triggerText: "Fire detection coverage is incomplete and may delay warning."
    };

  if (action.seriousCompartmentationFailure)
    return {
      tier: "T3",
      priority: "P2",
      triggerId: "COMP-P2-01",
      triggerText: "Compartmentation deficiencies likely to compromise the intended strategy."
    };

  if (action.singleStairCompromised)
    return {
      tier: "T3",
      priority: "P2",
      triggerId: "MOE-P2-01",
      triggerText: "Stair/escape route weaknesses increase the potential for smoke spread during evacuation."
    };

  if (action.noFraEvidenceOrReview)
    return {
      tier: "T3",
      priority: "P2",
      triggerId: "MGMT-P2-01",
      triggerText: "Insufficient evidence of fire safety management arrangements and review."
    };

  // P3 / T2 - Management/Housekeeping defaults
  if (
    action.category === "Management" ||
    action.category === "Housekeeping" ||
    action.category === "FireFighting"
  ) {
    return {
      tier: "T2",
      priority: "P3",
      triggerId: "GEN-P3-01",
      triggerText: "Improvement required to strengthen fire safety management arrangements."
    };
  }

  // P4 / T1 - Default/good practice
  return {
    tier: "T1",
    priority: "P4",
    triggerId: "GEN-P4-01",
    triggerText: "Good practice recommendation."
  };
}

/**
 * Returns Tier (T1..T4) using deterministic, defensible trigger rules.
 * No Likelihood x Impact.
 *
 * @deprecated Use deriveSeverity() instead for full trigger context
 */
export function deriveSeverityTier(
  action: FraActionInput,
  ctx: FraContext
): FraSeverityTier {
  return deriveSeverity(action, ctx).tier;
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
