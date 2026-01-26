import { supabase } from '../lib/supabase';

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

    const { data: actions, error: actionsError } = await supabase
      .from('actions')
      .select('id, reference_number, status')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });

    if (actionsError) throw actionsError;
    if (!actions || actions.length === 0) {
      console.log('[Action Ref] No actions found for document');
      return;
    }

    console.log('[Action Ref] Found', actions.length, 'actions');

    const { data: relatedDocs, error: docsError } = await supabase
      .from('documents')
      .select('id')
      .eq('base_document_id', baseDocumentId);

    if (docsError) {
      console.warn('[Action Ref] Failed to fetch related documents:', docsError);
    }

    const documentIds = relatedDocs?.map(doc => doc.id).filter(id => typeof id === 'string') || [];
    console.log('[Action Ref] Found', documentIds.length, 'related documents in series');

    let existingRefs = [];
    if (documentIds.length > 0) {
      const { data: refs, error: refsError } = await supabase
        .from('actions')
        .select('reference_number')
        .not('reference_number', 'is', null)
        .in('document_id', documentIds);

      if (refsError) {
        console.warn('[Action Ref] Failed to fetch existing reference numbers:', refsError);
      } else {
        existingRefs = refs || [];
      }
    }

    let maxNumber = 0;
    if (existingRefs.length > 0) {
      for (const ref of existingRefs) {
        const match = ref.reference_number?.match(/R-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNumber) maxNumber = num;
        }
      }
    }

    console.log('[Action Ref] Max existing reference number:', maxNumber);
    let nextNumber = maxNumber + 1;

    for (const action of actions) {
      if (!action.reference_number) {
        const refNumber = `R-${nextNumber.toString().padStart(2, '0')}`;

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
