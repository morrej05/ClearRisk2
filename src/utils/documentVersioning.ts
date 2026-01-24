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
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

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

    // 3) Modules exist + have payload
    const { data: modules, error: moduleError } = await supabase
      .from('module_instances')
      .select('id, module_key, payload')
      .eq('document_id', documentId)
      .eq('organisation_id', organisationId);

    if (moduleError) {
      return { valid: false, errors: [`MODULES QUERY ERROR: ${moduleError.message}`] };
    }

    if (!modules || modules.length === 0) {
      errors.push('Document must have at least one module');
    } else {
      for (const m of modules) {
        if (!m.payload || Object.keys(m.payload).length === 0) {
          errors.push(`Module ${m.module_key} has no data`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
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

    // Get document to check for previous version
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('base_document_id')
      .eq('id', documentId)
      .single();

    if (docError) throw docError;

    // Find previously issued document in this chain
    const { data: previousIssued } = await supabase
      .from('documents')
      .select('id')
      .eq('base_document_id', document.base_document_id)
      .eq('issue_status', 'issued')
      .neq('id', documentId)
      .maybeSingle();

    // Issue the document
    const { error } = await supabase
      .from('documents')
      .update({
        issue_status: 'issued',
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
      .select('*')
      .eq('base_document_id', baseDocumentId)
      .eq('issue_status', 'issued')
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
      .maybeSingle();

    if (draftError) throw draftError;

    if (existingDraft) {
      return { success: false, error: 'A draft version already exists for this document' };
    }

    const newVersionNumber = currentIssued.version_number + 1;

    const newDocData = {
      organisation_id: organisationId,
      base_document_id: baseDocumentId,
      version_number: newVersionNumber,
      title: currentIssued.title,
      document_type: currentIssued.document_type,
      issue_status: 'draft',
      issue_date: null,
      issued_by: null,
      status: 'draft',
      executive_summary_ai: null,
      executive_summary_author: null,
      executive_summary_mode: 'ai',
      approval_status: 'not_submitted',
      locked_pdf_path: null,
      locked_pdf_generated_at: null,
      locked_pdf_size_bytes: null,
    };

    const { data: newDocument, error: newDocError } = await supabase
      .from('documents')
      .insert([newDocData])
      .select()
      .single();

    if (newDocError) throw newDocError;

const { data: modules, error: moduleError } = await supabase
  .from('module_instances')
  .select('id, module_key')
  .eq('document_id', documentId)
  .eq('organisation_id', organisationId);

    if (modulesError) throw modulesError;

    if (modules && modules.length > 0) {
      const newModules = modules.map((m) => ({
        organisation_id: organisationId,
        document_id: newDocument.id,
        module_key: m.module_key,
        payload: m.payload,
        outcome: m.outcome,
      }));

      const { error: moduleInsertError } = await supabase
        .from('module_instances')
        .insert(newModules);

      if (moduleInsertError) throw moduleInsertError;
    }

    const { data: actions, error: actionsError } = await supabase
      .from('actions')
      .select('*')
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

      const carriedActions = actions.map((action) => {
        const { data: oldModule } = supabase
          .from('module_instances')
          .select('module_key')
          .eq('id', action.module_instance_id)
          .single();

        return {
          organisation_id: organisationId,
          document_id: newDocument.id,
          source_document_id: action.source_document_id,
          module_instance_id: action.module_instance_id,
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
      const evidenceResult = await carryForwardEvidence(
        currentIssued.id,
        newDocument.id,
        baseDocumentId,
        organisationId
      );

      if (!evidenceResult.success) {
        console.error('Error carrying forward evidence:', evidenceResult.error);
      }
    }

    return {
      success: true,
      newDocumentId: newDocument.id,
      newVersionNumber: newVersionNumber,
    };
  } catch (error) {
    console.error('Error creating new version:', error);
    return { success: false, error: 'Failed to create new version' };
  }
}

export async function supersedeDocumentAndIssueNew(
  oldDocumentId: string,
  newDocumentId: string,
  userId: string
): Promise<IssueDocumentResult> {
  try {
    const { error: supersedeError } = await supabase
      .from('documents')
      .update({
        issue_status: 'superseded',
        superseded_by_document_id: newDocumentId,
        superseded_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', oldDocumentId);

    if (supersedeError) throw supersedeError;

    const issueResult = await issueDocument(newDocumentId, userId);
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
