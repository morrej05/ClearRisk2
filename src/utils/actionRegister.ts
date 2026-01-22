import { supabase } from '../lib/supabase';

export interface ActionRegisterEntry {
  id: string;
  organisation_id: string;
  document_id: string;
  document_title: string;
  issue_date: string | null;
  recommended_action: string;
  priority_band: string;
  timescale: string | null;
  target_date: string | null;
  status: string;
  owner_user_id: string | null;
  owner_name: string | null;
  source: string;
  created_at: string;
  closed_at: string | null;
  carried_from_document_id: string | null;
  origin_action_id: string | null;
  tracking_status: 'closed' | 'overdue' | 'due_soon' | 'on_track';
  age_days: number;
}

export interface OrgActionStats {
  organisation_id: string;
  total_actions: number;
  open_actions: number;
  closed_actions: number;
  in_progress_actions: number;
  p1_actions: number;
  p2_actions: number;
  p3_actions: number;
  p4_actions: number;
  overdue_actions: number;
  avg_closure_days: number | null;
}

export async function getActionRegisterSiteLevel(
  documentId: string
): Promise<ActionRegisterEntry[]> {
  try {
    const { data, error } = await supabase
      .from('action_register_site_level')
      .select('*')
      .eq('document_id', documentId)
      .order('priority_band', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching site-level action register:', error);
    return [];
  }
}

export async function getActionRegisterOrgLevel(
  organisationId: string
): Promise<ActionRegisterEntry[]> {
  try {
    const { data, error } = await supabase
      .from('action_register_site_level')
      .select('*')
      .eq('organisation_id', organisationId)
      .order('tracking_status', { ascending: false })
      .order('priority_band', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching org-level action register:', error);
    return [];
  }
}

export async function getOrgActionStats(
  organisationId: string
): Promise<OrgActionStats | null> {
  try {
    const { data, error } = await supabase
      .from('action_register_org_level')
      .select('*')
      .eq('organisation_id', organisationId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching org action stats:', error);
    return null;
  }
}

export function filterActionRegister(
  actions: ActionRegisterEntry[],
  filters: {
    status?: string[];
    priority?: string[];
    trackingStatus?: string[];
    overdue?: boolean;
    documentId?: string;
  }
): ActionRegisterEntry[] {
  let filtered = [...actions];

  if (filters.status && filters.status.length > 0) {
    filtered = filtered.filter(a => filters.status!.includes(a.status));
  }

  if (filters.priority && filters.priority.length > 0) {
    filtered = filtered.filter(a => filters.priority!.includes(a.priority_band));
  }

  if (filters.trackingStatus && filters.trackingStatus.length > 0) {
    filtered = filtered.filter(a => filters.trackingStatus!.includes(a.tracking_status));
  }

  if (filters.overdue) {
    filtered = filtered.filter(a => a.tracking_status === 'overdue');
  }

  if (filters.documentId) {
    filtered = filtered.filter(a => a.document_id === filters.documentId);
  }

  return filtered;
}

export function exportActionRegisterToCSV(actions: ActionRegisterEntry[]): string {
  const headers = [
    'Document',
    'Issue Date',
    'Action',
    'Priority',
    'Timescale',
    'Target Date',
    'Status',
    'Owner',
    'Source',
    'Tracking Status',
    'Age (Days)',
    'Created',
    'Closed',
  ];

  const rows = actions.map(action => [
    action.document_title,
    action.issue_date || '',
    action.recommended_action,
    action.priority_band,
    action.timescale || '',
    action.target_date || '',
    action.status,
    action.owner_name || '',
    action.source,
    action.tracking_status,
    action.age_days.toString(),
    new Date(action.created_at).toLocaleDateString(),
    action.closed_at ? new Date(action.closed_at).toLocaleDateString() : '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}

export function downloadActionRegisterCSV(actions: ActionRegisterEntry[], filename: string) {
  const csv = exportActionRegisterToCSV(actions);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function getActionRegisterStats(actions: ActionRegisterEntry[]) {
  return {
    total: actions.length,
    open: actions.filter(a => a.status === 'open').length,
    closed: actions.filter(a => a.status === 'closed').length,
    inProgress: actions.filter(a => a.status === 'in_progress').length,
    overdue: actions.filter(a => a.tracking_status === 'overdue').length,
    dueSoon: actions.filter(a => a.tracking_status === 'due_soon').length,
    onTrack: actions.filter(a => a.tracking_status === 'on_track').length,
    p1: actions.filter(a => a.priority_band === 'P1').length,
    p2: actions.filter(a => a.priority_band === 'P2').length,
    p3: actions.filter(a => a.priority_band === 'P3').length,
    p4: actions.filter(a => a.priority_band === 'P4').length,
  };
}

export function getTrackingStatusColor(status: string): string {
  switch (status) {
    case 'closed':
      return 'text-green-700 bg-green-100 border-green-300';
    case 'overdue':
      return 'text-red-700 bg-red-100 border-red-300';
    case 'due_soon':
      return 'text-amber-700 bg-amber-100 border-amber-300';
    case 'on_track':
      return 'text-blue-700 bg-blue-100 border-blue-300';
    default:
      return 'text-neutral-700 bg-neutral-100 border-neutral-300';
  }
}

export function getTrackingStatusLabel(status: string): string {
  switch (status) {
    case 'closed':
      return 'Closed';
    case 'overdue':
      return 'Overdue';
    case 'due_soon':
      return 'Due Soon';
    case 'on_track':
      return 'On Track';
    default:
      return status;
  }
}
