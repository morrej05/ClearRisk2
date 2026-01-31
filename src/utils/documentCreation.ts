import { supabase } from '../lib/supabase';
import { getModuleKeysForDocType } from '../lib/modules/moduleCatalog';

export type DocumentType = 'FRA' | 'FSD' | 'DSEAR' | 'RE';

interface CreateDocumentParams {
  organisationId: string;
  documentType: DocumentType;
  title?: string;
  jurisdiction?: string;
}

export async function createDocument({
  organisationId,
  documentType,
  title,
  jurisdiction = 'UK'
}: CreateDocumentParams): Promise<string> {
  const documentTitle = title || `New ${documentType}`;
  const assessmentDate = new Date().toISOString().split('T')[0];

  const documentData = {
    organisation_id: organisationId,
    document_type: documentType,
    title: documentTitle,
    status: 'draft',
    version: 1,
    assessment_date: assessmentDate,
    jurisdiction,
  };

  console.log('[documentCreation.createDocument] Insert payload:', documentData);

  const { data: document, error: docError } = await supabase
    .from('documents')
    .insert([documentData])
    .select()
    .single();

  if (docError) {
    console.error('[documentCreation.createDocument] Insert failed:', docError);
    console.error('[documentCreation.createDocument] Error details:', {
      code: docError.code,
      message: docError.message,
      details: docError.details,
      hint: docError.hint,
      full: docError,
    });
    throw docError;
  }

  if (!document) {
    console.error('[documentCreation.createDocument] No document returned from insert');
    throw new Error('Document creation failed - no data returned');
  }

  if (!document.id) {
    console.error('[documentCreation.createDocument] Document missing ID:', document);
    throw new Error('Document creation failed - no ID generated');
  }

  console.log('[documentCreation.createDocument] Created document:', document.id, 'type:', documentType);

  const moduleKeys = getModuleKeysForDocType(documentType);
  console.log('[documentCreation.createDocument] Module keys for', documentType, ':', moduleKeys);

  const moduleInstances = moduleKeys.map((moduleKey) => ({
    organisation_id: organisationId,
    document_id: document.id,
    module_key: moduleKey,
    module_scope: 'document',
    outcome: null,
    assessor_notes: '',
    data: {},
  }));

  if (moduleInstances.length > 0) {
    const { error: modulesError } = await supabase
      .from('module_instances')
      .insert(moduleInstances);

    if (modulesError) {
      console.error('[documentCreation.createDocument] Module instances insert failed:', modulesError);
      throw modulesError;
    }

    console.log('[documentCreation.createDocument] Created', moduleInstances.length, 'module instances');
  }

  return document.id;
}

/**
 * Ensures all required module instances exist for a document.
 * Useful for backfilling missing modules in existing documents.
 * Uses upsert to safely add only missing modules without creating duplicates.
 */
export async function ensureRequiredModules(
  documentId: string,
  documentType: DocumentType,
  organisationId: string
): Promise<void> {
  console.log('[documentCreation.ensureRequiredModules] Checking modules for document:', documentId, 'type:', documentType);

  const requiredModuleKeys = getModuleKeysForDocType(documentType);
  console.log('[documentCreation.ensureRequiredModules] Required modules:', requiredModuleKeys);

  const { data: existingModules, error: fetchError } = await supabase
    .from('module_instances')
    .select('module_key')
    .eq('document_id', documentId);

  if (fetchError) {
    console.error('[documentCreation.ensureRequiredModules] Failed to fetch existing modules:', fetchError);
    throw fetchError;
  }

  const existingKeys = new Set(existingModules?.map(m => m.module_key) || []);
  const missingKeys = requiredModuleKeys.filter(key => !existingKeys.has(key));

  console.log('[documentCreation.ensureRequiredModules] Existing:', Array.from(existingKeys), 'Missing:', missingKeys);

  if (missingKeys.length > 0) {
    const newModuleInstances = missingKeys.map(moduleKey => ({
      organisation_id: organisationId,
      document_id: documentId,
      module_key: moduleKey,
      module_scope: 'document',
      outcome: null,
      assessor_notes: '',
      data: {},
    }));

    const { error: insertError } = await supabase
      .from('module_instances')
      .insert(newModuleInstances);

    if (insertError) {
      console.error('[documentCreation.ensureRequiredModules] Failed to insert missing modules:', insertError);
      throw insertError;
    }

    console.log('[documentCreation.ensureRequiredModules] Added', missingKeys.length, 'missing modules:', missingKeys);
  } else {
    console.log('[documentCreation.ensureRequiredModules] All required modules already exist');
  }
}

export async function createPropertySurvey(
  userId: string,
  companyName: string
): Promise<string> {
  const surveyDate = new Date().toISOString().split('T')[0];

  const insertPayload = {
    user_id: userId,
    framework_type: 'fire_property',
    survey_type: 'Full',
    report_status: 'Draft',
    property_name: 'Untitled Survey',
    property_address: '',
    company_name: companyName,
    survey_date: surveyDate,
    issued: false,
    form_data: {
      companyName,
      surveyDate,
      reportStatus: 'Draft',
    },
  };

  console.log('[documentCreation.createPropertySurvey] Insert payload:', insertPayload);

  const { data, error } = await supabase
    .from('survey_reports')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error('[documentCreation.createPropertySurvey] Insert failed:', error);
    console.error('[documentCreation.createPropertySurvey] Error details:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      full: error,
    });
    throw error;
  }

  if (!data) {
    console.error('[documentCreation.createPropertySurvey] No survey returned from insert');
    throw new Error('Survey creation failed - no data returned');
  }

  if (!data.id) {
    console.error('[documentCreation.createPropertySurvey] Survey missing ID:', data);
    throw new Error('Survey creation failed - no ID generated');
  }

  console.log('[documentCreation.createPropertySurvey] Created survey:', data.id);

  return data.id;
}
