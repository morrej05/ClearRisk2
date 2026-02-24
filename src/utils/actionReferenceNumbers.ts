import { supabase } from '../lib/supabase';

/**
 * Get reference year from document issue date or current year
 */
function getRefYear(document: any): number {
  // Prefer issue_date year if present, else current year
  const d = document?.issue_date ? new Date(document.issue_date) : new Date();
  const y = d.getFullYear();
  return Number.isFinite(y) ? y : new Date().getFullYear();
}

/**
 * Canonical action sort comparator (same as FRA PDF)
 * - priority_band ASC (P1 → P4)
 * - target_date ASC (nulls last)
 * - created_at ASC
 */
function sortActionsForRenumbering(a: any, b: any): number {
  const priorityRank = (p?: string) => {
    const v = (p || '').toUpperCase().trim();
    if (v === 'P1') return 1;
    if (v === 'P2') return 2;
    if (v === 'P3') return 3;
    if (v === 'P4') return 4;
    return 99;
  };

  const dateValue = (d?: string | null) => {
    if (!d) return Number.POSITIVE_INFINITY;
    const t = new Date(d).getTime();
    return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
  };

  const pr = priorityRank(a.priority_band) - priorityRank(b.priority_band);
  if (pr !== 0) return pr;

  const td = dateValue(a.target_date) - dateValue(b.target_date);
  if (td !== 0) return td;

  const ca = new Date(a.created_at).getTime();
  const cb = new Date(b.created_at).getTime();
  return ca - cb;
}

export async function assignActionReferenceNumbers(
  documentId: string,
  baseDocumentId: string
): Promise<void> {
  try {
    if (typeof documentId !== 'string' || !documentId) {
      throw new Error(`Invalid documentId: expected string UUID, got ${typeof documentId}: ${documentId}`);
    }
    if (typeof baseDocumentId !== 'string' || !baseDocumentId) {
      throw new Error(`Invalid baseDocumentId: expected string UUID, got ${typeof baseDocumentId}: ${baseDocumentId}`);
    }

    console.log('[Action Ref] Assigning reference numbers for document:', documentId);

    // Fetch document metadata for year
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, issue_date')
      .eq('id', documentId)
      .single();

    if (docError) {
      console.warn('[Action Ref] Failed to fetch document metadata:', docError);
    }

    const year = getRefYear(document);
    console.log('[Action Ref] Using reference year:', year);

    // Fetch all actions for THIS DOCUMENT ONLY (not lineage)
    const { data: actions, error: actionsError } = await supabase
      .from('actions')
      .select('id, reference_number, status, priority_band, target_date, created_at')
      .eq('document_id', documentId);

    if (actionsError) throw actionsError;
    if (!actions || actions.length === 0) {
      console.log('[Action Ref] No actions found for document');
      return;
    }

    console.log('[Action Ref] Found', actions.length, 'actions');

    // Find max existing number in new format (FRA-YYYY-###) for THIS document only
    const existingRefs = actions.filter(a => a.reference_number).map(a => a.reference_number);
    let maxNumber = 0;

    for (const ref of existingRefs) {
      // Match new format: FRA-YYYY-###
      const match = ref.match(/^FRA-(\d{4})-(\d{3})$/);
      if (match) {
        const num = parseInt(match[2], 10);
        if (num > maxNumber) maxNumber = num;
      }
    }

    console.log('[Action Ref] Max existing reference number:', maxNumber);

    // Identify actions needing (re)assignment
    const actionsNeedingRefs = actions.filter(a => {
      if (!a.reference_number) return true; // No ref
      // Old format (R-xx) needs renumbering
      if (a.reference_number.match(/^R-\d+$/)) return true;
      return false;
    });

    if (actionsNeedingRefs.length === 0) {
      console.log('[Action Ref] All actions already have new-format references');
      return;
    }

    console.log('[Action Ref] Found', actionsNeedingRefs.length, 'actions needing (re)assignment');

    // Sort actions in canonical order for deterministic assignment
    const sortedActions = [...actionsNeedingRefs].sort(sortActionsForRenumbering);

    let nextNumber = maxNumber + 1;

    for (const action of sortedActions) {
      const refNumber = `FRA-${year}-${String(nextNumber).padStart(3, '0')}`;

      const { error: updateError } = await supabase
        .from('actions')
        .update({ reference_number: refNumber })
        .eq('id', action.id);

      if (updateError) {
        console.error('[Action Ref] Failed to assign reference number:', updateError);
      } else {
        console.log('[Action Ref] Assigned', refNumber, 'to action', action.id);
        nextNumber++;
      }
    }

    console.log('[Action Ref] Reference number assignment complete');
  } catch (error) {
    console.error('[Action Ref] Error assigning action reference numbers:', error);
    throw error;
  }
}

export async function carryForwardActionReferenceNumbers(
  sourceDocumentId: string,
  targetDocumentId: string
): Promise<void> {
  try {
    const { data: sourceActions, error: sourceError } = await supabase
      .from('actions')
      .select('id, reference_number, first_raised_in_version')
      .eq('document_id', sourceDocumentId)
      .not('reference_number', 'is', null);

    if (sourceError) throw sourceError;
    if (!sourceActions || sourceActions.length === 0) return;

    const { data: targetActions, error: targetError } = await supabase
      .from('actions')
      .select('id, origin_action_id')
      .eq('document_id', targetDocumentId)
      .not('origin_action_id', 'is', null);

    if (targetError) throw targetError;
    if (!targetActions) return;

    for (const targetAction of targetActions) {
      const sourceAction = sourceActions.find(sa => sa.id === targetAction.origin_action_id);
      if (sourceAction?.reference_number) {
        const { error: updateError } = await supabase
          .from('actions')
          .update({
            reference_number: sourceAction.reference_number,
            first_raised_in_version: sourceAction.first_raised_in_version,
          })
          .eq('id', targetAction.id);

        if (updateError) {
          console.error('Failed to carry forward reference number:', updateError);
        }
      }
    }
  } catch (error) {
    console.error('Error carrying forward action reference numbers:', error);
    throw error;
  }
}
