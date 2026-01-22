import { supabase } from '../lib/supabase';

export interface ActionRegisterEntry {
  id: string;
  organisation_id: string;
  document_id: string;
  document_title: string;
  document_type: string;
  base_document_id: string;
  version_number: number;
  issue_status: string;
  issue_date: string | null;
  module_instance_id: string | null;
  module_key: string | null;
  module_outcome: any;
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
    documentType?: string[];
    moduleKey?: string[];
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

  if (filters.documentType && filters.documentType.length > 0) {
    filtered = filtered.filter(a => filters.documentType!.includes(a.document_type));
  }

  if (filters.moduleKey && filters.moduleKey.length > 0) {
    filtered = filtered.filter(a => a.module_key && filters.moduleKey!.includes(a.module_key));
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
    'Priority',
    'Status',
    'Recommended Action',
    'Owner',
    'Target Date',
    'Module Key',
    'Document Title',
    'Document Type',
    'Version Number',
    'Issue Status',
    'Issue Date',
    'Tracking Status',
    'Timescale',
    'Source',
    'Age (Days)',
    'Created Date',
    'Closed Date',
  ];

  const rows = actions.map(action => [
    action.priority_band,
    action.status,
    action.recommended_action,
    action.owner_name || 'Unassigned',
    action.target_date || 'Not set',
    action.module_key || 'N/A',
    action.document_title,
    action.document_type,
    action.version_number.toString(),
    action.issue_status,
    action.issue_date || 'Not issued',
    action.tracking_status,
    action.timescale || '',
    action.source,
    action.age_days.toString(),
    new Date(action.created_at).toLocaleDateString(),
    action.closed_at ? new Date(action.closed_at).toLocaleDateString() : '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
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

export function getUniqueModuleKeys(actions: ActionRegisterEntry[]): string[] {
  const keys = actions
    .map(a => a.module_key)
    .filter((key): key is string => key !== null && key !== undefined);
  return Array.from(new Set(keys)).sort();
}

export function getUniqueDocumentTypes(actions: ActionRegisterEntry[]): string[] {
  const types = actions.map(a => a.document_type);
  return Array.from(new Set(types)).sort();
}

export function getModuleKeyLabel(key: string): string {
  const labels: Record<string, string> = {
    'A1': 'A1 - Document Control',
    'A2': 'A2 - Building Profile',
    'A3': 'A3 - Persons at Risk',
    'A4': 'A4 - Management Controls',
    'A5': 'A5 - Emergency Arrangements',
    'FRA1': 'FRA1 - Fire Hazards',
    'FRA2': 'FRA2 - Means of Escape',
    'FRA3': 'FRA3 - Fire Protection',
    'FRA4': 'FRA4 - Significant Findings',
    'FRA5': 'FRA5 - External Fire Spread',
    'FSD1': 'FSD1 - Regulatory Basis',
    'FSD2': 'FSD2 - Evacuation Strategy',
    'FSD3': 'FSD3 - Means of Escape Design',
    'FSD4': 'FSD4 - Passive Fire Protection',
    'FSD5': 'FSD5 - Active Fire Systems',
    'FSD6': 'FSD6 - Fire Service Access',
    'FSD7': 'FSD7 - Drawings Index',
    'FSD8': 'FSD8 - Smoke Control',
    'FSD9': 'FSD9 - Construction Phase',
    'DSEAR1': 'DSEAR1 - Dangerous Substances',
    'DSEAR2': 'DSEAR2 - Process Releases',
    'DSEAR3': 'DSEAR3 - Hazardous Area Classification',
    'DSEAR4': 'DSEAR4 - Ignition Sources',
    'DSEAR5': 'DSEAR5 - Explosion Protection',
    'DSEAR6': 'DSEAR6 - Risk Assessment Table',
    'DSEAR10': 'DSEAR10 - Hierarchy Control',
    'DSEAR11': 'DSEAR11 - Emergency Response',
  };
  return labels[key] || key;
}
