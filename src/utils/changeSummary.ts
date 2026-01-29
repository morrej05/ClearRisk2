import { supabase } from '../lib/supabase';

export interface ChangeSummary {
  id: string;
  organisation_id: string;
  document_id: string;
  previous_document_id: string | null;
  new_actions_count: number;
  closed_actions_count: number;
  reopened_actions_count: number;
  outstanding_actions_count: number;
  new_actions: Array<{
    id: string;
    recommended_action: string;
    priority_band: string;
    status: string;
  }>;
  closed_actions: Array<{
    id: string;
    recommended_action: string;
    priority_band: string;
    closure_date: string;
  }>;
  reopened_actions: any[];
  risk_rating_changes: any[];
  material_field_changes: any[];
  summary_text: string | null;
  has_material_changes: boolean;
  visible_to_client: boolean;
  generated_at: string;
  generated_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Create the FIRST issue summary for a document.
 * Any existing summaries for this document are deleted first
 * to prevent duplicates.
 */
export async function createInitialIssueSummary(
  documentId: string,
  userId: string
): Promise<{ success: boolean; summaryId?: string; error?: string }> {
  try {
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('organisation_id, base_document_id')
      .eq('id', documentId)
      .single();

    if (docError) throw docError;

    const { data: actions, error: actionsError } = await supabase
      .from('actions')
      .select('id, recommended_action, priority_band, status')
      .eq('document_id', documentId)
      .is('deleted_at', null);

    if (actionsError) throw actionsError;

    const openActions =
      actions?.filter(a =>
        ['open', 'in_progress', 'deferred'].includes(a.status)
      ) || [];

    const summaryData = {
      organisation_id: document.organisation_id,
      base_document_id: document.base_document_id,
      document_id: documentId,
      previous_document_id: null,
      new_actions_count: openActions.length,
      closed_actions_count: 0,
      reopened_actions_count: 0,
      outstanding_actions_count: openActions.length,
      new_actions: openActions.map(a => ({
        id: a.id,
        recommended_action: a.recommended_action,
        priority_band: a.priority_band,
        status: a.status,
      })),
      closed_actions: [],
      reopened_actions: [],
      risk_rating_changes: [],
      material_field_changes: [],
      summary_text: null,
      has_material_changes: false,
      visible_to_client: true,
      generated_by: userId,
    };

    // 🔥 IMPORTANT: remove any existing summaries for this document
    const { error: deleteError } = await supabase
      .from('document_change_summaries')
      .delete()
      .eq('document_id', documentId);

    if (deleteError) throw deleteError;

    const { data: summary, error: insertError } = await supabase
      .from('document_change_summaries')
      .insert([summaryData])
      .select('id')
      .single();

    if (insertError) throw insertError;

    return { success: true, summaryId: summary.id };
  } catch (error: any) {
    console.error('Error creating initial issue summary:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate a change summary between two issued versions
 * (uses Postgres RPC)
 */
export async function generateChangeSummary(
  newDocumentId: string,
  oldDocumentId: string,
  userId: string
): Promise<{ success: boolean; summaryId?: string; error?: string }> {
  try {
    // Defensive cleanup in case this gets called twice
    await supabase
      .from('document_change_summaries')
      .delete()
      .eq('document_id', newDocumentId);

    const { data, error } = await supabase.rpc('generate_change_summary', {
      p_new_document_id: newDocumentId,
      p_old_document_id: oldDocumentId,
      p_user_id: userId,
    });

    if (error) throw error;

    return { success: true, summaryId: data };
  } catch (error: any) {
    console.error('Error generating change summary:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get the most recent change summary for a document
 */
export async function getChangeSummary(
  documentId: string
): Promise<ChangeSummary | null> {
  try {
    const { data, error } = await supabase
      .from('change_summaries')
      .select('version_number, created_at, summary_text, full_name, created_by, base_document_id')
      .eq('base_document_id', documentId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching change summary:', error);
    return null;
  }
}

/**
 * Get all change summaries for an organisation
 */
export async function getChangeSummaries(
  organisationId: string
): Promise<ChangeSummary[]> {
  try {
    const { data, error } = await supabase
      .from('document_change_summaries')
      .select('*')
      .eq('organisation_id', organisationId)
      .order('generated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching change summaries:', error);
    return [];
  }
}

/**
 * Format a change summary as markdown text
 */
export function formatChangeSummaryText(summary: ChangeSummary): string {
  const lines: string[] = [];

  lines.push('# Changes Since Last Issue\n');

  if (summary.new_actions_count > 0) {
    lines.push(`## New Actions (${summary.new_actions_count})\n`);
    summary.new_actions.forEach(action => {
      lines.push(`- [${action.priority_band}] ${action.recommended_action}`);
    });
    lines.push('');
  }

  if (summary.closed_actions_count > 0) {
    lines.push(`## Closed Actions (${summary.closed_actions_count})\n`);
    summary.closed_actions.forEach(action => {
      lines.push(`- [${action.priority_band}] ${action.recommended_action}`);
    });
    lines.push('');
  }

  if (summary.outstanding_actions_count > 0) {
    lines.push(
      `## Outstanding Actions: ${summary.outstanding_actions_count}\n`
    );
  }

  if (!summary.has_material_changes) {
    lines.push('_No material changes since last issue._\n');
  }

  return lines.join('\n');
}

export function getChangeSummaryStats(summary: ChangeSummary) {
  return {
    totalChanges:
      summary.new_actions_count +
      summary.closed_actions_count +
      summary.reopened_actions_count,
    newActions: summary.new_actions_count,
    closedActions: summary.closed_actions_count,
    outstandingActions: summary.outstanding_actions_count,
    hasMaterialChanges: summary.has_material_changes,
    improvement: summary.closed_actions_count > summary.new_actions_count,
    deterioration: summary.new_actions_count > summary.closed_actions_count,
  };
}

export async function updateChangeSummaryText(
  summaryId: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('document_change_summaries')
      .update({
        summary_text: text,
        updated_at: new Date().toISOString(),
      })
      .eq('id', summaryId);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error updating change summary text:', error);
    return { success: false, error: error.message };
  }
}

export async function setChangeSummaryClientVisibility(
  summaryId: string,
  visible: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('document_change_summaries')
      .update({
        visible_to_client: visible,
        updated_at: new Date().toISOString(),
      })
      .eq('id', summaryId);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error updating change summary visibility:', error);
    return { success: false, error: error.message };
  }
}
