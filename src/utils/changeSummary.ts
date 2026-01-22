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

export async function generateChangeSummary(
  newDocumentId: string,
  oldDocumentId: string,
  userId: string
): Promise<{ success: boolean; summaryId?: string; error?: string }> {
  try {
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

export async function getChangeSummary(
  documentId: string
): Promise<ChangeSummary | null> {
  try {
    const { data, error } = await supabase
      .from('document_change_summaries')
      .select('*')
      .eq('document_id', documentId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching change summary:', error);
    return null;
  }
}

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

export function formatChangeSummaryText(summary: ChangeSummary): string {
  const lines: string[] = [];

  lines.push('# Changes Since Last Issue\n');

  if (summary.new_actions_count > 0) {
    lines.push(`## New Actions (${summary.new_actions_count})\n`);
    summary.new_actions.forEach((action) => {
      lines.push(`- [${action.priority_band}] ${action.recommended_action}`);
    });
    lines.push('');
  }

  if (summary.closed_actions_count > 0) {
    lines.push(`## Closed Actions (${summary.closed_actions_count})\n`);
    summary.closed_actions.forEach((action) => {
      lines.push(`- [${action.priority_band}] ${action.recommended_action}`);
    });
    lines.push('');
  }

  if (summary.outstanding_actions_count > 0) {
    lines.push(`## Outstanding Actions: ${summary.outstanding_actions_count}\n`);
  }

  if (!summary.has_material_changes) {
    lines.push('_No material changes since last issue._\n');
  }

  return lines.join('\n');
}

export function getChangeSummaryStats(summary: ChangeSummary) {
  return {
    totalChanges: summary.new_actions_count + summary.closed_actions_count + summary.reopened_actions_count,
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
      .update({ summary_text: text, updated_at: new Date().toISOString() })
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
      .update({ visible_to_client: visible, updated_at: new Date().toISOString() })
      .eq('id', summaryId);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error updating change summary visibility:', error);
    return { success: false, error: error.message };
  }
}
