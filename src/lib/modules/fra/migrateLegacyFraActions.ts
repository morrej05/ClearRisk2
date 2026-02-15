// src/lib/modules/fra/migrateLegacyFraActions.ts

import {
  deriveSeverityTier,
  mapTierToPriority,
  type FraContext,
  type FraSeverityTier,
  type FraPriority,
  type FraActionInput,
} from './severityEngine';

/**
 * Migrates a legacy FRA action from L×I scoring to the new severity engine.
 *
 * This function:
 * - Preserves existing severityTier and priority if already set
 * - Maps legacy riskScore bands to severity tiers
 * - Falls back to severity engine rules if no score available
 *
 * @param action Legacy action with likelihood/impact/riskScore
 * @param ctx FRA context (occupancy risk, storeys)
 * @returns Action with severityTier and priority populated
 */
export function migrateLegacyFraAction(action: any, ctx: FraContext): any {
  // If already migrated, skip
  if (action.severity_tier && action.priority_band) {
    return action;
  }

  let tier: FraSeverityTier = 'T2';

  // Try to use legacy riskScore if available
  const score = action.risk_score ?? null;

  if (score !== null) {
    // Map legacy score bands to new severity tiers
    // Original mapping: P1: 20-25, P2: 12-19, P3: 6-11, P4: 1-5
    // We're being slightly more conservative in the migration
    if (score >= 20) tier = 'T4'; // P1 material life safety
    else if (score >= 12) tier = 'T3'; // P2 significant deficiency
    else if (score >= 6) tier = 'T2'; // P3 improvement required
    else tier = 'T1'; // P4 minor
  } else {
    // No score available - try to use severity engine
    // Build action input from available fields
    const actionInput: FraActionInput = {
      category: action.finding_category || 'Other',
      finalExitLocked: action.final_exit_locked || false,
      finalExitObstructed: action.final_exit_obstructed || false,
      noFireDetection: action.no_fire_detection || false,
      detectionInadequateCoverage: action.detection_inadequate_coverage || false,
      noEmergencyLighting: action.no_emergency_lighting || false,
      seriousCompartmentationFailure: action.serious_compartmentation_failure || false,
      singleStairCompromised: action.single_stair_compromised || false,
      highRiskRoomToEscapeRoute: action.high_risk_room_to_escape_route || false,
      noFraEvidenceOrReview: action.no_fra_evidence_or_review || false,
    };

    tier = deriveSeverityTier(actionInput, ctx);
  }

  // Map tier to priority
  const priority = mapTierToPriority(tier);

  // Return migrated action
  return {
    ...action,
    severity_tier: tier,
    priority_band: priority,
  };
}

/**
 * Migrates an array of legacy FRA actions.
 *
 * @param actions Array of legacy actions
 * @param ctx FRA context
 * @returns Array of migrated actions
 */
export function migrateLegacyFraActions(
  actions: any[],
  ctx: FraContext
): any[] {
  return actions.map((action) => migrateLegacyFraAction(action, ctx));
}

/**
 * Checks if an action needs migration.
 *
 * @param action Action to check
 * @returns true if migration needed
 */
export function needsMigration(action: any): boolean {
  return !action.severity_tier || !action.priority_band;
}
