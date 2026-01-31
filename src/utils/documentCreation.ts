import { supabase } from '../lib/supabase';

const MODULE_SKELETONS = {
  FRA: [
    'A1_DOC_CONTROL',
    'A2_BUILDING_PROFILE',
    'A3_PERSONS_AT_RISK',
    'A4_MANAGEMENT_CONTROLS',
    'A5_EMERGENCY_ARRANGEMENTS',
    'A7_REVIEW_ASSURANCE',
    'FRA_1_HAZARDS',
    'FRA_2_ESCAPE_ASIS',
    'FRA_3_PROTECTION_ASIS',
    'FRA_5_EXTERNAL_FIRE_SPREAD',
    'FRA_4_SIGNIFICANT_FINDINGS',
  ],
  FSD: [
    'A1_DOC_CONTROL',
    'A2_BUILDING_PROFILE',
    'FSD_1_REG_BASIS',
    'FSD_2_EVAC_STRATEGY',
    'FSD_3_ESCAPE_DESIGN',
    'FSD_4_PASSIVE_PROTECTION',
    'FSD_5_ACTIVE_SYSTEMS',
    'FSD_6_FRS_ACCESS',
    'FSD_7_DRAWINGS',
    'FSD_8_SMOKE_CONTROL',
    'FSD_9_CONSTRUCTION_PHASE',
  ],
  DSEAR: [
    'A1_DOC_CONTROL',
    'A2_BUILDING_PROFILE',
    'DSEAR_1_SUBSTANCES_REGISTER',
    'DSEAR_2_PROCESS_RELEASES',
    'DSEAR_3_HAC_ZONING',
    'DSEAR_4_IGNITION_CONTROL',
    'DSEAR_5_MITIGATION',
    'DSEAR_6_RISK_TABLE',
    'DSEAR_10_HIERARCHY_SUBSTITUTION',
    'DSEAR_11_EXPLOSION_EMERGENCY_RESPONSE',
  ],
};

export type DocumentType = 'FRA' | 'FSD' | 'DSEAR';

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

  const moduleKeys = MODULE_SKELETONS[documentType] || [];

  const moduleInstances = moduleKeys.map((moduleKey) => ({
    organisation_id: organisationId,
    document_id: document.id,
    module_key: moduleKey,
    module_scope: 'document',
    outcome: null,
    assessor_notes: '',
    data: {},
  }));

  const { error: modulesError } = await supabase
    .from('module_instances')
    .insert(moduleInstances);

  if (modulesError) {
    console.error('[documentCreation.createDocument] Module instances insert failed:', modulesError);
    throw modulesError;
  }

  return document.id;
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
