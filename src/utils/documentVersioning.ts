import { supabase } from '../lib/supabase';
import { canIssueDocument } from './approvalWorkflow';
import { generateChangeSummary, createInitialIssueSummary } from './changeSummary';
import { carryForwardEvidence } from './evidenceManagement';

export interface DocumentVersion {
  id: string;
  base_document_id: string;
  version_number: number;
  issue_status: 'draft' | 'issued' | 'superseded';
  issue_date: string | null;
  issued_by: string | null;
  superseded_by_document_id: string | null;
  superseded_date: string | null;
  title: string;
  document_type: string;
  created_at: string;
}

export interface IssueDocumentResult {
  success: boolean;
  error?: string;
  documentId?: string;
}

export interface CreateNewVersionResult {
  success: boolean;
  error?: string;
  newDocumentId?: string;
  newVersionNumber?: number;
}

export async function validateDocumentForIssue(
  documentId: string,
  organisationId: string
): Promise<{ valid: boolean; errors: string[]; warnings?: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // 1) Document exists + accessible
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, organisation_id, issue_status, document_type, approval_status')
      .eq('id', documentId)
      .eq('organisation_id', organisationId)
      .maybeSingle();

    if (docError) {
      return { valid: false, errors: [`DOC QUERY ERROR: ${docError.message}`] };
    }
    if (!document) {
      return { valid: false, errors: ['DOC NOT FOUND (or blocked by RLS)'] };
    }

    if (document.issue_status !== 'draft') {
      return { valid: false, errors: ['Only draft documents can be issued'] };
    }

    // 2) Approval check (if your workflow enforces it)
    const approvalCheck = await canIssueDocument(documentId, organisationId);
    if (!approvalCheck.canIssue) {
      errors.push(approvalCheck.reason || 'Approval check failed');
    }

    // 3) Modules exist + have data
    const { data: modules, error: moduleError } = await supabase
      .from('module_instances')
      .select('module_key, data, assessor_notes, completed_at')
      .eq('document_id', documentId)
      .eq('organisation_id', organisationId);

    if (moduleError) {
      return { valid: false, errors: [`MODULES QUERY ERROR: ${moduleError.message}`] };
    }

    if (!modules || modules.length === 0) {
      errors.push('Document must have at least one module');
    } else {
      // Define required modules for FRA (minimum for professional completeness)
      const REQUIRED_FRA_MODULES = [
        'A1_DOC_CONTROL',
        'A2_BUILDING_PROFILE',
        'A3_PERSONS_AT_RISK',
        'A5_EMERGENCY_ARRANGEMENTS',
        'FRA_4_SIGNIFICANT_FINDINGS'
      ];

      const isEmptyObject = (v: any) =>
        !v || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);

      const moduleHasData = (m: any) => {
        const hasJson = !isEmptyObject(m.data);
        const hasNotes =
          typeof m.assessor_notes === 'string' &&
          m.assessor_notes.trim().length > 0;
        const isCompleted = !!m.completed_at;

        return hasJson || hasNotes || isCompleted;
      };

      // For FRA documents, only require the minimum set
      if (document.document_type === 'FRA') {
        const requiredModuleKeys = new Set(REQUIRED_FRA_MODULES);
        const modulesMap = new Map(modules.map(m => [m.module_key, m]));

        // Check required modules
        for (const requiredKey of requiredModuleKeys) {
          const module = modulesMap.get(requiredKey);
          if (!module) {
            errors.push(`Required module ${requiredKey} is missing`);
          } else if (!moduleHasData(module)) {
            errors.push(`Required module ${requiredKey} has no data`);
          }
        }

        // Check optional modules - add warnings but don't block
        for (const m of modules) {
          if (!requiredModuleKeys.has(m.module_key) && !moduleHasData(m)) {
            warnings.push(`Optional module ${m.module_key} has no data`);
          }
        }
      } else {
        // For non-FRA documents (FSD, DSEAR), check all modules
        for (const m of modules) {
          if (!moduleHasData(m)) {
            errors.push(`Module ${m.module_key} has no data`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings: warnings.length > 0 ? warnings : undefined };
  } catch (e: any) {
    const msg =
      e?.message ||
      (typeof e === 'string' ? e : 'Unknown error');
    console.error('Error validating document:', e);
    return { valid: false, errors: [`VALIDATION THREW: ${msg}`] };
  }
}


export async function issueDocument(documentId: string, userId: string, organisationId: string): Promise<IssueDocumentResult> {
  try {
    const validation = await validateDocumentForIssue(documentId, organisationId);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(', ') };
    }

    // Get document to check for previous version AND locked PDF
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('base_document_id, locked_pdf_path')
      .eq('id', documentId)
      .single();

    if (docError) throw docError;

    // CRITICAL: Validate that a locked PDF exists before issuing
    if (!document.locked_pdf_path) {
      return {
        success: false,
        error: 'Cannot issue document without a locked PDF. The PDF must be generated and locked before the document can be issued.'
      };
    }

    // Find previously issued document in this chain
const { data: previousIssued, error: prevErr } = await supabase
  .from('documents')
  .select('id')
  .eq('base_document_id', document.base_document_id)
  .eq('issue_status', 'issued')
  .neq('id', documentId)
  .order('version_number', { ascending: false })
  .limit(1)
  .maybeSingle();

if (prevErr) throw prevErr;

    // Supersede previous issued document FIRST (DB requires this)
    if (previousIssued?.id) {
      const { error: supersedePrevError } = await supabase
        .from('documents')
        .update({
          issue_status: 'superseded',
          status: 'superseded',
          superseded_by_document_id: documentId,
          superseded_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', previousIssued.id);
    
      if (supersedePrevError) throw supersedePrevError;
    }
    
    // Issue the document
    const { error } = await supabase
      .from('documents')
      .update({
        issue_status: 'issued',
        status: 'issued',
        issue_date: new Date().toISOString().split('T')[0],
        issued_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);
    
    if (error) throw error;

    // Generate change summary
    if (previousIssued) {
      // Compare with previous issued version
      await generateChangeSummary(documentId, previousIssued.id, userId);
    } else {
      // First issue - create initial summary
      await createInitialIssueSummary(documentId, userId);
    }

    return { success: true, documentId };
  } catch (error) {
    console.error('Error issuing document:', error);
    return { success: false, error: 'Failed to issue document' };
  }
}

export async function createNewVersion(
  baseDocumentId: string,
  userId: string,
  organisationId: string,
  shouldCarryForwardEvidence: boolean = true
): Promise<CreateNewVersionResult> {
  try {
    const { data: currentIssued, error: currentError } = await supabase
      .from('documents')
      .select(`
        id,
        organisation_id,
        base_document_id,
        version_number,
        title,
        document_type,
        assessor_name,
        assessment_date,
        issue_date,
        review_date,
        scope_description,
        limitations_assumptions,
        standards_selected,
        enabled_modules,
        jurisdiction
      `)
      .eq('base_document_id', baseDocumentId)
      .eq('issue_status', 'issued')
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (currentError) throw currentError;

    if (!currentIssued) {
      return { success: false, error: 'No issued version found to create new version from' };
    }

    const { data: existingDraft, error: draftError } = await supabase
      .from('documents')
      .select('id')
      .eq('base_document_id', baseDocumentId)
      .eq('issue_status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (draftError) throw draftError;

    if (existingDraft) {
      return { success: false, error: 'A draft version already exists for this document' };
    }

    const newVersionNumber = currentIssued.version_number + 1;

    const currentDate = new Date().toISOString().slice(0, 10);

    const newDocData = {
      organisation_id: organisationId,
      base_document_id: baseDocumentId,
      version_number: newVersionNumber,
      title: currentIssued.title,
      document_type: currentIssued.document_type,
      assessor_name: currentIssued.assessor_name,
      assessment_date: currentIssued.assessment_date || currentIssued.issue_date || currentDate,
      review_date: currentIssued.review_date,
      scope_description: currentIssued.scope_description,
      limitations_assumptions: currentIssued.limitations_assumptions,
      standards_selected: currentIssued.standards_selected,
      enabled_modules: currentIssued.enabled_modules,
      jurisdiction: currentIssued.jurisdiction,
      issue_status: 'draft' as const,
      issue_date: null,
      issued_by: null,
      status: 'draft' as const,
      executive_summary_ai: null,
      executive_summary_author: null,
      executive_summary_mode: currentIssued.executive_summary_mode || 'ai',
      approval_status: currentIssued.approval_status ?? 'approved',
      locked_pdf_path: null,
      locked_pdf_generated_at: null,
      locked_pdf_size_bytes: null,      
    };

    console.log('[createNewVersion] insert keys', Object.keys(newDocData), 'assessment_date=', newDocData.assessment_date, newDocData);

    const { data: newDocument, error: newDocError } = await supabase
      .from('documents')
      .insert([newDocData])
      .select('*')
      .single();

    if (newDocError) throw newDocError;

    const { data: modules, error: moduleError } = await supabase
      .from('module_instances')
      .select('id, module_key, module_scope, data, outcome, assessor_notes, completed_at')
      .eq('document_id', currentIssued.id)
      .eq('organisation_id', organisationId);

    if (moduleError) throw moduleError;

    if (modules && modules.length > 0) {
      const newModules = modules.map((m) => ({
        organisation_id: organisationId,
        document_id: newDocument.id,
        module_key: m.module_key,
        module_scope: m.module_scope,
        data: m.data,
        outcome: m.outcome,
        assessor_notes: m.assessor_notes,
        completed_at: m.completed_at,
      }));

      const { error: moduleInsertError } = await supabase
        .from('module_instances')
        .insert(newModules);

      if (moduleInsertError) throw moduleInsertError;
    }

    const { data: actions, error: actionsError } = await supabase
      .from('actions')
      .select(`
        id,
        organisation_id,
        document_id,
        source_document_id,
        module_instance_id,
        recommended_action,
        status,
        priority_band,
        timescale,
        target_date,
        override_justification,
        source,
        owner_user_id,
        origin_action_id
      `)
      .eq('document_id', currentIssued.id)
      .in('status', ['open', 'in_progress', 'deferred'])
      .is('deleted_at', null);

    if (actionsError) throw actionsError;

    if (actions && actions.length > 0) {
      const { data: newModuleInstances } = await supabase
        .from('module_instances')
        .select('id, module_key')
        .eq('document_id', newDocument.id);

      const moduleKeyToNewId: Record<string, string> = {};
      newModuleInstances?.forEach((m) => {
        moduleKeyToNewId[m.module_key] = m.id;
      });

      const { data: oldModuleInstances } = await supabase
        .from('module_instances')
        .select('id, module_key')
        .eq('document_id', currentIssued.id);

      const oldModuleIdToKey: Record<string, string> = {};
      oldModuleInstances?.forEach((m) => {
        oldModuleIdToKey[m.id] = m.module_key;
      });

      const carriedActions = actions.map((action) => {
        const oldModuleKey = oldModuleIdToKey[action.module_instance_id];
        const newModuleInstanceId = oldModuleKey ? moduleKeyToNewId[oldModuleKey] : action.module_instance_id;

        return {
          organisation_id: organisationId,
          document_id: newDocument.id,
          source_document_id: action.source_document_id || currentIssued.id,
          module_instance_id: newModuleInstanceId,
          recommended_action: action.recommended_action,
          status: action.status,
          priority_band: action.priority_band,
          timescale: action.timescale,
          target_date: action.target_date,
          override_justification: action.override_justification,
          source: action.source,
          owner_user_id: action.owner_user_id,
          origin_action_id: action.origin_action_id || action.id,
          carried_from_document_id: currentIssued.id,
        };
      });

      const { error: actionsInsertError } = await supabase
        .from('actions')
        .insert(carriedActions);

      if (actionsInsertError) {
        console.error('Error carrying forward actions:', actionsInsertError);
      }
    }

    if (shouldCarryForwardEvidence) {
      try {
        const evidenceResult = await carryForwardEvidence(
          currentIssued.id,
          newDocument.id,
          baseDocumentId,
          organisationId
        );

        if (!evidenceResult.success) {
          console.error('Error carrying forward evidence:', evidenceResult.error);
        }
      } catch (evidenceError) {
        console.error('Exception carrying forward evidence:', evidenceError);
      }
    }

    try {
      await createInitialIssueSummary(newDocument.id, userId);
    } catch (summaryError) {
      console.error('Error creating initial summary (non-blocking):', summaryError);
    }

    return {
      success: true,
      newDocumentId: newDocument.id,
      newVersionNumber: newVersionNumber,
    };
  } catch (error: any) {
    console.error('Error creating new version:', error);
    const errorMessage = error?.message || 'Failed to create new version';
    return { success: false, error: errorMessage };
  }
}

export async function supersedeDocumentAndIssueNew(
  oldDocumentId: string,
  newDocumentId: string,
  userId: string,
  organisationId: string
): Promise<IssueDocumentResult> {
  try {
    const { error: supersedeError } = await supabase
      .from('documents')
      .update({
        issue_status: 'superseded',
        status: 'superseded',
        superseded_by_document_id: newDocumentId,
        superseded_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', oldDocumentId);

    if (supersedeError) throw supersedeError;

    const issueResult = await issueDocument(newDocumentId, userId, organisationId);
    return issueResult;
  } catch (error) {
    console.error('Error superseding document:', error);
    return { success: false, error: 'Failed to supersede and issue document' };
  }
}

export async function getDocumentVersionHistory(baseDocumentId: string): Promise<DocumentVersion[]> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('base_document_id', baseDocumentId)
      .order('version_number', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching version history:', error);
    return [];
  }
}

export async function canEditDocument(documentId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('issue_status')
      .eq('id', documentId)
      .single();

    if (error) throw error;
    return data.issue_status === 'draft';
  } catch (error) {
    console.error('Error checking document edit permission:', error);
    return false;
  }
}
