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
  jurisdiction = 'UK',
}: CreateDocumentParams): Promise<string> {
  const documentTitle = title || `New ${documentType}`;
  const assessmentDate = new Date().toISOString().split('T')[0];

  // Initialize section grades for RE documents with fire_protection defaulting to 1
  const sectionGrades = documentType === 'RE' ? {
    survey_info: 3,
    property_details: 3,
    construction: 3,
    occupancy: 3,
    management: 3,
    fire_protection: 1,  // CRITICAL DEFAULT: Fire Protection starts at 1 (Inadequate)
    business_continuity: 3,
    loss_expectancy: 3,
    hazards: 3,
    natural_hazards: 3,
    recommendations: 3,
    attachments: 3
  } : {};

  const documentData = {
    organisation_id: organisationId,
    document_type: documentType,
    title: documentTitle,
    status: 'draft',
    version: 1,
    assessment_date: assessmentDate,
    jurisdiction,
    section_grades: sectionGrades,
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

  if (!document?.id) {
    console.error('[documentCreation.createDocument] Document creation failed - missing document/id:', document);
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
    data: initialiseModuleData(moduleKey, documentType),
  }));

  if (moduleInstances.length > 0) {
    // Prefer upsert so we don't ever create duplicates (requires unique constraint on (document_id, module_key))
    const { error: modulesError } = await supabase
      .from('module_instances')
      .upsert(moduleInstances, {
        onConflict: 'document_id,module_key',
        ignoreDuplicates: true,
      });

    if (modulesError) {
      console.error('[documentCreation.createDocument] Module instances upsert failed:', modulesError);
      throw modulesError;
    }

    console.log('[documentCreation.createDocument] Created/ensured', moduleInstances.length, 'module instances');
  }

  return document.id;
}

function isEmptyPlainObject(value: unknown): boolean {
  if (!value || typeof value !== 'object') return true;
  if (Array.isArray(value)) return false;
  return Object.keys(value as Record<string, unknown>).length === 0;
}

/**
 * Provides default module data payloads (currently only for Risk Engineering).
 */
function initialiseModuleData(moduleKey: string, documentType: DocumentType) {
  // Only apply defaults for Risk Engineering
  if (documentType !== 'RE') return {};

  switch (moduleKey) {
    case 'RE_01_DOC_CONTROL':
      return {
        version: 'v1',
        section_key: 'doc_control',
        assessor: { name: '', role: '', company: '' },
        attendance: { met_onsite_with: '', present_during_survey: '' },
        dates: { assessment_date: null, review_date: null },
        client_site: { client: '', site: '', address: '', country: '' },
        scope: { scope_description: '', limitations_assumptions: '' },
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
        ratings: { site_rating_1_5: null, site_rating_notes: '' },
        buildings: [],
      };

    case 'RE_03_OCCUPANCY':
      return {
        version: 'v1',
        section_key: 'occupancy',
        ratings: { site_rating_1_5: null, site_rating_notes: '' },
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
        ratings: { site_rating_1_5: null, site_rating_notes: '' },
        building_protection_table: [],
        systems: {
          sprinklers: {
            present: null,
            type: '',
            design_standard: '',
            itm_notes: '',
            impairment_notes: '',
          },
          detection_alarm: {
            present: null,
            coverage_notes: '',
            monitoring_to_arc: null,
          },
          hydrants: { on_site: null, coverage_notes: '', maintenance_notes: '' },
          smoke_control: { present: null, notes: '' },
          passive_protection: { notes: '' },
        },
        water_supply: {
          reliability: null,
          primary_source: '',
          redundancy: '',
          test_history_notes: '',
        },
        nle_impact: {
          credible_to_reduce_nle_significantly: null,
          basis: '',
        },
      };

    case 'RE_07_NATURAL_HAZARDS':
      return {
        version: 'v1',
        section_key: 'natural_hazards',
        ratings: { site_rating_1_5: null, site_rating_notes: '' },
        hazards: [
          { key: 'flood', exposure: '', controls: '', notes: '' },
          { key: 'wind', exposure: '', controls: '', notes: '' },
          { key: 'quake', exposure: '', controls: '', notes: '' },
          { key: 'wildfire', exposure: '', controls: '', notes: '' },
          { key: 'lightning', exposure: '', controls: '', notes: '' },
          { key: 'subsidence', exposure: '', controls: '', notes: '' },
        ],
      };

    case 'RE_08_UTILITIES':
      return {
        version: 'v1',
        section_key: 'utilities',
        ratings: { site_rating_1_5: null, site_rating_notes: '' },
        power_resilience: { notes: '', backup_power_present: null, generator_capacity_notes: '' },
        shutdown_strategy: { notes: '' },
        critical_services: {
          fuel_gas: { present: null, notes: '' },
          refrigeration: { present: null, notes: '' },
          compressed_air_steam: { present: null, notes: '' },
          water_supplies: { present: null, notes: '' },
        },
        single_points_of_failure: [],
      };

    case 'RE_09_MANAGEMENT':
      return {
        version: 'v1',
        section_key: 'management_systems',
        help: {
          rating_guidance_note:
            'Engineer rates current condition 1–5. Poor/inadequate items should trigger recommendations.',
        },
        ratings: { site_rating_1_5: null, site_rating_notes: '' },
        categories: [
          { key: 'housekeeping', rating_1_5: null, notes: '' },
          { key: 'hot_work', rating_1_5: null, notes: '' },
          { key: 'impairment_management', rating_1_5: null, notes: '' },
          { key: 'contractor_control', rating_1_5: null, notes: '' },
          { key: 'maintenance', rating_1_5: null, notes: '' },
          { key: 'emergency_planning', rating_1_5: null, notes: '' },
          { key: 'change_management', rating_1_5: null, notes: '' },
        ],
      };

    case 'RE_10_PROCESS_RISK':
      return {
        version: 'v1',
        section_key: 'process_risk',
        ratings: { site_rating_1_5: null, site_rating_notes: '' },
        process_overview: '',
      };

    case 'RE_12_LOSS_VALUES':
      return {
        version: 'v1',
        section_key: 'loss_values',
        currency: 'GBP',
        property_sums_insured: { breakdown: [], total: null },
        business_interruption: { gross_profit: null, indemnity_period_months: null, dependencies: [] },
        worst_case_le: { scenario_description: '', calc_table: [] },
        normal_loss_expectancy: { scenario_description: '', calc_table: [] },
      };

    case 'RE_13_RECOMMENDATIONS':
      return {
        version: 'v1',
        section_key: 'recommendations',
        settings: {
          numbering_prefix: '',
          numbering_includes_year_month: true,
          max_images_per_recommendation: 3,
        },
        summary_table: [],
        report_tail_uploads: {
          site_images: [],
          site_plans_process_drawings: [],
        },
      };

    case 'RE_14_DRAFT_OUTPUTS':
      return {
        version: 'v1',
        section_key: 'draft_outputs',
        draft_survey_report: { content: '' },
        draft_loss_prevention_report: { content: '' },
      };

    case 'RISK_ENGINEERING':
      return {
        version: 'v1',
        document_type: 'RE',
        industry_key: null,
        scoring: {
          rating_scale: '1_to_5',
          weighting_source: 'sector_weightings + hrg_master_map',
          sections: {
            construction: { weight: null, rating_1_5: null, weighted_score: null },
            management_systems: { weight: null, rating_1_5: null, weighted_score: null },
            fire_protection: { weight: null, rating_1_5: null, weighted_score: null },
            natural_hazards: { weight: null, rating_1_5: null, weighted_score: null },
            utilities: { weight: null, rating_1_5: null, weighted_score: null },
            special_hazards: { weight: null, rating_1_5: null, weighted_score: null },
          },
          overall: { total_weighted_score: null, max_possible: null, percent: null, band: null },
        },
      };

    default:
      return {};
  }
}

/**
 * Ensures all required module instances exist for a document.
 * - Adds any missing modules (safe upsert)
 * - For RE only: backfills empty {} data to defaults (prevents “blank UI”)
 */
export async function ensureRequiredModules(
  documentId: string,
  documentType: DocumentType,
  organisationId: string
): Promise<void> {
  console.log(
    '[documentCreation.ensureRequiredModules] Checking modules for document:',
    documentId,
    'type:',
    documentType
  );

  const requiredModuleKeys = getModuleKeysForDocType(documentType);
  console.log('[documentCreation.ensureRequiredModules] Required modules:', requiredModuleKeys);

  const { data: existingModules, error: fetchError } = await supabase
    .from('module_instances')
    .select('id, module_key, data')
    .eq('document_id', documentId);

  if (fetchError) {
    console.error('[documentCreation.ensureRequiredModules] Failed to fetch existing modules:', fetchError);
    throw fetchError;
  }

  const existingKeys = new Set(existingModules?.map((m) => m.module_key) || []);
  const missingKeys = requiredModuleKeys.filter((key) => !existingKeys.has(key));

  console.log('[documentCreation.ensureRequiredModules] Existing:', Array.from(existingKeys), 'Missing:', missingKeys);

  // 1) Insert/ensure missing modules (use upsert to avoid duplicates)
  if (missingKeys.length > 0) {
    const newModuleInstances = missingKeys.map((moduleKey) => ({
      organisation_id: organisationId,
      document_id: documentId,
      module_key: moduleKey,
      module_scope: 'document',
      outcome: null,
      assessor_notes: '',
      data: initialiseModuleData(moduleKey, documentType),
    }));

    const { error: upsertError } = await supabase
      .from('module_instances')
      .upsert(newModuleInstances, {
        onConflict: 'document_id,module_key',
        ignoreDuplicates: true,
      });

    if (upsertError) {
      console.error('[documentCreation.ensureRequiredModules] Failed to upsert missing modules:', upsertError);
      throw upsertError;
    }

    console.log('[documentCreation.ensureRequiredModules] Ensured', missingKeys.length, 'modules:', missingKeys);
  } else {
    console.log('[documentCreation.ensureRequiredModules] All required modules already exist');
  }

  // 2) Backfill existing RE modules that have empty {} data (prevents “blank UI”)
  if (documentType === 'RE' && existingModules?.length) {
    const empties = existingModules.filter((m) => isEmptyPlainObject(m.data));

    for (const m of empties) {
      const defaults = initialiseModuleData(m.module_key, documentType);

      // If we don't have defaults for that key, skip (don’t overwrite with {})
      if (isEmptyPlainObject(defaults)) continue;

      const { error: updateError } = await supabase
        .from('module_instances')
        .update({ data: defaults })
        .eq('id', m.id);

      if (updateError) {
        console.error(
          '[documentCreation.ensureRequiredModules] Failed to backfill module data:',
          m.module_key,
          updateError
        );
        throw updateError;
      }
    }

    if (empties.length) {
      console.log(
        '[documentCreation.ensureRequiredModules] Backfilled empty RE modules:',
        empties.map((e) => e.module_key)
      );
    }
  }
}

export async function createPropertySurvey(userId: string, companyName: string): Promise<string> {
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

  const { data, error } = await supabase.from('survey_reports').insert(insertPayload).select().single();

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

  if (!data?.id) {
    console.error('[documentCreation.createPropertySurvey] Survey creation failed - missing data/id:', data);
    throw new Error('Survey creation failed - no ID generated');
  }

  console.log('[documentCreation.createPropertySurvey] Created survey:', data.id);
  return data.id;
}
