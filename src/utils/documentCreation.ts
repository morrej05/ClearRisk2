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

function initialiseModuleData(
  moduleKey: string,
  documentType: DocumentType
) {
  // Only apply defaults for Risk Engineering
  if (documentType !== 'RE') return {};

  switch (moduleKey) {
    case 'RE_01_DOC_CONTROL':
      return {
        version: 'v1',
        section_key: 'doc_control',
        assessor: {
          name: '',
          role: '',
          company: '',
        },
        attendance: {
          met_onsite_with: '',
          present_during_survey: '',
        },
        dates: {
          assessment_date: null,
          review_date: null,
        },
        client_site: {
          client: '',
          site: '',
          address: '',
          country: '',
        },
        scope: {
          scope_description: '',
          limitations_assumptions: '',
        },
        reference_documents_reviewed: [],
      };

    case 'RE_02_CONSTRUCTION':
      return {
        version: 'v1',
        section_key: 'construction',
        help: {
          method_note:
            'Roof/ceiling drives combustibility more than walls. Frame influences collapse exposure; record separately.',
        },
        ratings: {
          site_rating_1_5: null,
          site_rating_notes: '',
        },
        buildings: [],
      };

    case 'RE_03_OCCUPANCY':
      return {
        version: 'v1',
        section_key: 'occupancy',
        ratings: {
          site_rating_1_5: null,
          site_rating_notes: '',
        },
        occupancy_overview: {
          industry_key: null,
          process_overview: '',
          operating_hours: '',
          headcount: null,
          critical_dependencies: [],
        },
        special_hazards: {
          rating_1_5: null,
          notes: '',
          hazard_types: [
            { type: 'ignitable_liquids', present: null, details: '' },
            { type: 'flammable_gases_chemicals', present: null, details: '' },
            { type: 'dusts_explosive_atmospheres', present: null, details: '' },
            { type: 'specialised_industrial_equipment', present: null, details: '' },
            { type: 'emerging_risks', present: null, details: '' },
          ],
          custom_items: [],
        },
      };

    case 'RE_06_FIRE_PROTECTION':
      return {
        version: 'v1',
        section_key: 'fire_protection',
        help: {
          table_note:
            'Add one row per building/area. Record protected % vs recommended % then set adequacy.',
        },
        ratings: {
          site_rating_1_5: null,
          site_rating_notes: '',
        },
        building_protection_table: [],
        systems: {
          sprinklers: { present: null, type: '', design_standard: '', itm_notes: '', impairment_notes: '' },
          detection_alarm: { present: null, coverage_notes: '', monitoring_to_arc: null },
          hydrants: { on_site: null, coverage_notes: '', maintenance_notes: '' },
          smoke_control: { present: null, notes: '' },
          passive_protection: { notes: '' },
        },
        water_supply: {
          primary_source: '',
          redundancy: '',
          reliability: null,
          test_history_notes: '',
        },
        nle_impact: {
          credible_to_reduce_nle_significantly: null,
          basis: '',
        },
      };

    // Add remaining RE_* modules the same way…

    default:
      return { version: 'v1' };
  }
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
      data: initialiseModuleData(moduleKey, documentType),
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
