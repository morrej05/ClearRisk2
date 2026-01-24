/**
 * Unified Report Data Loader
 *
 * Loads report data from either:
 * - Snapshot (immutable issued revisions from survey_revisions.snapshot)
 * - Live (current draft data from survey_reports)
 *
 * This ensures issued reports are immutable and always render from snapshots.
 */

import { supabase } from '../lib/supabase';

export interface ReportMetadata {
  id: string;
  property_name: string;
  property_address: string;
  company_name: string | null;
  survey_date: string | null;
  issue_date: string | null;
  survey_type: string;
  surveyor_company_name?: string | null;
  site_contact?: string | null;
  scope_type?: string | null;
  scope_limitations?: string | null;
  engineered_solutions_used?: boolean;
  [key: string]: any;
}

export interface ReportData {
  meta: ReportMetadata;
  answers: Record<string, any>;
  actions?: any[];
  recommendations?: any[];
  moduleProgress?: Record<string, 'not_started' | 'in_progress' | 'complete'>;
  source: 'snapshot' | 'live';
  status: 'draft' | 'issued' | 'superseded';
  revisionNumber: number;
  issuedAt?: string | null;
  issuedBy?: string | null;
}

interface LoadReportDataOptions {
  surveyId: string;
  revisionNumber?: number | null;
}

/**
 * Load report data from snapshot or live source
 */
export async function loadReportData(options: LoadReportDataOptions): Promise<ReportData | null> {
  const { surveyId, revisionNumber } = options;

  // CASE A: Load from snapshot (issued revision)
  if (revisionNumber !== null && revisionNumber !== undefined) {
    return await loadFromSnapshot(surveyId, revisionNumber);
  }

  // CASE B: Load from live (current draft/issued state)
  return await loadFromLive(surveyId);
}

/**
 * Load from survey_revisions.snapshot (immutable)
 */
async function loadFromSnapshot(surveyId: string, revisionNumber: number): Promise<ReportData | null> {
  try {
    const { data: revision, error } = await supabase
      .from('survey_revisions')
      .select('*')
      .eq('survey_id', surveyId)
      .eq('revision_number', revisionNumber)
      .maybeSingle();

    if (error) {
      console.error('Error loading revision snapshot:', error);
      return null;
    }

    if (!revision || !revision.snapshot) {
      console.warn(`Revision ${revisionNumber} not found for survey ${surveyId}`);
      return null;
    }

    const snapshot = revision.snapshot;

    // Extract metadata from snapshot
    const meta: ReportMetadata = snapshot.survey_metadata || {
      id: surveyId,
      property_name: snapshot.property_name || 'Unknown Property',
      property_address: snapshot.property_address || '',
      company_name: snapshot.company_name || null,
      survey_date: snapshot.survey_date || null,
      issue_date: snapshot.issue_date || null,
      survey_type: snapshot.survey_type || snapshot.document_type || 'fra',
      surveyor_company_name: snapshot.surveyor_company_name || null,
      site_contact: snapshot.site_contact || null,
      scope_type: snapshot.scope_type || null,
      scope_limitations: snapshot.scope_limitations || null,
      engineered_solutions_used: snapshot.engineered_solutions_used || false,
    };

    return {
      meta,
      answers: snapshot.answers || {},
      actions: snapshot.actions || [],
      recommendations: snapshot.recommendations || [],
      moduleProgress: snapshot.moduleProgress || {},
      source: 'snapshot',
      status: 'issued',
      revisionNumber,
      issuedAt: revision.issued_at,
      issuedBy: revision.issued_by,
    };
  } catch (error) {
    console.error('Error in loadFromSnapshot:', error);
    return null;
  }
}

/**
 * Load from survey_reports (live data)
 */
async function loadFromLive(surveyId: string): Promise<ReportData | null> {
  try {
    const { data: survey, error } = await supabase
      .from('survey_reports')
      .select('*')
      .eq('id', surveyId)
      .maybeSingle();

    if (error) {
      console.error('Error loading live survey:', error);
      return null;
    }

    if (!survey) {
      console.warn(`Survey ${surveyId} not found`);
      return null;
    }

    // Extract metadata
    const meta: ReportMetadata = {
      id: survey.id,
      property_name: survey.property_name || 'Unknown Property',
      property_address: survey.property_address || '',
      company_name: survey.company_name || null,
      survey_date: survey.survey_date || null,
      issue_date: survey.issue_date || null,
      survey_type: survey.survey_type || survey.document_type || 'fra',
      surveyor_company_name: survey.surveyor_company_name || null,
      site_contact: survey.site_contact || null,
      scope_type: survey.scope_type || null,
      scope_limitations: survey.scope_limitations || null,
      engineered_solutions_used: survey.engineered_solutions_used || false,
    };

    // Load recommendations
    const { data: recommendations } = await supabase
      .from('recommendations')
      .select('*')
      .eq('survey_id', surveyId)
      .order('order_index', { ascending: true });

    // Determine module progress from form_data or default to empty
    const moduleProgress = survey.form_data?.moduleProgress || {};

    return {
      meta,
      answers: survey.form_data || {},
      recommendations: recommendations || [],
      actions: [], // Actions might need separate loading if needed
      moduleProgress,
      source: 'live',
      status: survey.status || (survey.issued ? 'issued' : 'draft'),
      revisionNumber: survey.current_revision || 1,
      issuedAt: survey.issue_date || null,
      issuedBy: null,
    };
  } catch (error) {
    console.error('Error in loadFromLive:', error);
    return null;
  }
}

/**
 * List all issued revisions for a survey
 */
export async function listIssuedRevisions(surveyId: string) {
  try {
    const { data, error } = await supabase
      .from('survey_revisions')
      .select('revision_number, status, issued_at, issued_by, created_at')
      .eq('survey_id', surveyId)
      .eq('status', 'issued')
      .order('revision_number', { ascending: false });

    if (error) {
      console.error('Error listing revisions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in listIssuedRevisions:', error);
    return [];
  }
}

/**
 * Get the current survey status for determining default view
 */
export async function getSurveyStatus(surveyId: string) {
  try {
    const { data, error } = await supabase
      .from('survey_reports')
      .select('status, issued, current_revision')
      .eq('id', surveyId)
      .maybeSingle();

    if (error) {
      console.error('Error getting survey status:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getSurveyStatus:', error);
    return null;
  }
}
