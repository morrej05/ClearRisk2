/**
 * Migrates legacy DSEAR actions to structured trigger system.
 *
 * This runs client-side during document load and does not modify the database.
 * Legacy actions without trigger_text are enriched with default values.
 */

export function migrateLegacyDsearAction(action: any): any {
  // If already has trigger fields, skip
  if (action.trigger_id && action.trigger_text) {
    return action;
  }

  // Default legacy trigger for actions that don't have one
  return {
    ...action,
    trigger_id: action.trigger_id || 'LEGACY-DSEAR',
    trigger_text: action.trigger_text || 'Priority derived from previous assessment model.',
  };
}

/**
 * Migrates an array of DSEAR actions.
 */
export function migrateLegacyDsearActions(actions: any[]): any[] {
  return actions.map(migrateLegacyDsearAction);
}
