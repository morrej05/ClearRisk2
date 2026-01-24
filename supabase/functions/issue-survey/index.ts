import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface IssueRequest {
  survey_id: string;
  change_log?: string;
}

type SurveyType = 'FRA' | 'FSD' | 'DSEAR';
type IssueCtx = {
  scope_type?: 'full' | 'limited' | 'desktop' | 'other';
  engineered_solutions_used?: boolean;
  suppression_applicable?: boolean;
  smoke_control_applicable?: boolean;
};
type ModuleProgress = Record<string, 'not_started' | 'in_progress' | 'complete'>;

interface Blocker {
  type: string;
  moduleKey?: string;
  message: string;
}

interface ValidationResult {
  eligible: boolean;
  blockers: Blocker[];
}

// MODULE_KEYS mapping (from src/config/moduleKeys.ts)
const MODULE_KEYS = {
  survey_info: 'A1_DOC_CONTROL',
  property_details: 'A2_BUILDING_PROFILE',
  persons_at_risk: 'A3_PERSONS_AT_RISK',
  management: 'A4_MANAGEMENT_CONTROLS',
  emergency_arrangements: 'A5_EMERGENCY_ARRANGEMENTS',
  hazards: 'FRA_1_HAZARDS',
  means_of_escape: 'FRA_2_ESCAPE_ASIS',
  fire_protection: 'FRA_3_PROTECTION_ASIS',
  significant_findings: 'FRA_4_SIGNIFICANT_FINDINGS',
  external_fire_spread: 'FRA_5_EXTERNAL_FIRE_SPREAD',
  regulatory_basis: 'FSD_1_REG_BASIS',
  evacuation_strategy: 'FSD_2_EVAC_STRATEGY',
  escape_design: 'FSD_3_ESCAPE_DESIGN',
  passive_protection: 'FSD_4_PASSIVE_PROTECTION',
  active_systems: 'FSD_5_ACTIVE_SYSTEMS',
  frs_access: 'FSD_6_FRS_ACCESS',
  smoke_control: 'FSD_8_SMOKE_CONTROL',
  dangerous_substances: 'DSEAR_1_DANGEROUS_SUBSTANCES',
  process_releases: 'DSEAR_2_PROCESS_RELEASES',
  hazardous_area_classification: 'DSEAR_3_HAZARDOUS_AREA_CLASSIFICATION',
  ignition_sources: 'DSEAR_4_IGNITION_SOURCES',
  explosion_protection: 'DSEAR_5_EXPLOSION_PROTECTION',
  risk_assessment_table: 'DSEAR_6_RISK_ASSESSMENT',
  hierarchy_of_control: 'DSEAR_10_HIERARCHY_OF_CONTROL',
  explosion_emergency: 'DSEAR_11_EXPLOSION_EMERGENCY_RESPONSE',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const body: IssueRequest = await req.json();
    const { survey_id, change_log } = body;

    if (!survey_id) {
      return new Response(
        JSON.stringify({ error: 'survey_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 1. Fetch survey
    const { data: survey, error: surveyError } = await supabase
      .from('survey_reports')
      .select('*')
      .eq('id', survey_id)
      .eq('user_id', user.id)
      .single();

    if (surveyError || !survey) {
      return new Response(
        JSON.stringify({ error: 'Survey not found or access denied' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Check if already issued (HARD LOCK)
    if (survey.status === 'issued' || survey.issued === true) {
      return new Response(
        JSON.stringify({ error: 'Survey is already issued and locked. Create a revision to make changes.' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Build context
    const ctx: IssueCtx = {
      scope_type: survey.scope_type,
      engineered_solutions_used: survey.engineered_solutions_used || false,
      suppression_applicable: survey.form_data?.suppression_applicable || false,
      smoke_control_applicable: survey.form_data?.smoke_control_applicable || false,
    };

    // 4. Fetch module instances for progress tracking
    const { data: moduleInstances } = await supabase
      .from('module_instances')
      .select('module_key, completed_at')
      .eq('document_id', survey_id);

    // Build module progress map
    const moduleProgress: ModuleProgress = {};
    moduleInstances?.forEach((mi: any) => {
      moduleProgress[mi.module_key] = mi.completed_at ? 'complete' : 'in_progress';
    });

    // 5. Fetch actions/recommendations
    const { data: actions } = await supabase
      .from('recommendations')
      .select('id, status')
      .eq('survey_id', survey_id);

    // 6. Server-side validation
    const validation = validateIssueEligibility(
      survey.document_type as SurveyType,
      ctx,
      survey.form_data || {},
      moduleProgress,
      actions || []
    );

    if (!validation.eligible) {
      return new Response(
        JSON.stringify({
          error: 'Survey does not meet issue requirements',
          blockers: validation.blockers,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 7. Determine revision number
    const current_revision = survey.current_revision || 1;

    // Check if current revision already exists and is issued
    const { data: existingRevision } = await supabase
      .from('survey_revisions')
      .select('id, status')
      .eq('survey_id', survey_id)
      .eq('revision_number', current_revision)
      .maybeSingle();

    let revision_number = current_revision;
    if (existingRevision && existingRevision.status === 'issued') {
      revision_number = current_revision + 1;
    }

    // 8. Create revision snapshot
    const snapshot = {
      survey_metadata: {
        id: survey.id,
        document_type: survey.document_type,
        scope_type: survey.scope_type,
        scope_limitations: survey.scope_limitations,
        engineered_solutions_used: survey.engineered_solutions_used,
        property_name: survey.property_name,
        property_address: survey.property_address,
        company_name: survey.company_name,
        survey_date: survey.survey_date,
      },
      answers: survey.form_data || {},
      actions: actions || [],
      moduleProgress: moduleProgress,
      issued_at: new Date().toISOString(),
      issued_by: user.id,
      change_log: change_log || 'Initial issue',
    };

    // 9. Insert or update revision record
    const { data: revision, error: revisionError } = await supabase
      .from('survey_revisions')
      .upsert({
        survey_id: survey_id,
        revision_number: revision_number,
        status: 'issued',
        snapshot: snapshot,
        issued_at: new Date().toISOString(),
        issued_by: user.id,
        created_by: user.id,
      }, {
        onConflict: 'survey_id,revision_number'
      })
      .select()
      .single();

    if (revisionError) {
      console.error('Error creating revision:', revisionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create revision', details: revisionError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 10. Update survey to issued status
    const { error: updateError } = await supabase
      .from('survey_reports')
      .update({
        status: 'issued',
        issued: true,
        issue_date: new Date().toISOString().split('T')[0],
        current_revision: revision_number,
        change_log: change_log || 'Initial issue',
        updated_at: new Date().toISOString(),
      })
      .eq('id', survey_id);

    if (updateError) {
      console.error('Error updating survey:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update survey', details: updateError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 11. Return success
    return new Response(
      JSON.stringify({
        success: true,
        revision_number: revision_number,
        revision_id: revision.id,
        message: 'Survey issued successfully',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in issue-survey function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Validation logic (server-side copy from issueValidation.ts)
function validateIssueEligibility(
  type: SurveyType,
  ctx: IssueCtx,
  answers: any,
  moduleProgress: ModuleProgress,
  actions: Array<{ status: string }>
): ValidationResult {
  const blockers: Blocker[] = [];

  // Get required modules
  const requiredModules = getRequiredModules(type, ctx);

  // Check module completion
  for (const moduleKey of requiredModules) {
    const status = moduleProgress[moduleKey];
    if (status !== 'complete') {
      blockers.push({
        type: 'module_incomplete',
        moduleKey: moduleKey,
        message: `Module ${moduleKey} must be completed`,
      });
    }
  }

  // Survey-specific validations
  if (type === 'FRA') {
    if (ctx.scope_type && ['limited', 'desktop'].includes(ctx.scope_type) && !answers?.scope_limitations?.trim()) {
      blockers.push({
        type: 'conditional_missing',
        message: 'Scope limitations required for limited/desktop assessments',
      });
    }

    const hasRecommendations = actions && actions.filter(a => a.status !== 'closed').length > 0;
    const noSignificantFindings = answers?.no_significant_findings === true;

    if (!hasRecommendations && !noSignificantFindings) {
      blockers.push({
        type: 'no_recommendations',
        message: 'Must have recommendations OR confirm no significant findings',
      });
    }
  }

  if (type === 'FSD') {
    if (ctx.engineered_solutions_used) {
      if (!answers?.limitations_text?.trim()) {
        blockers.push({
          type: 'conditional_missing',
          message: 'Limitations required when using engineered solutions',
        });
      }
      if (!answers?.management_assumptions_text?.trim()) {
        blockers.push({
          type: 'conditional_missing',
          message: 'Management assumptions required when using engineered solutions',
        });
      }
    }
  }

  if (type === 'DSEAR') {
    const substances = answers?.substances;
    const noDangerousSubstances = answers?.no_dangerous_substances === true;
    if ((!substances || substances.length === 0) && !noDangerousSubstances) {
      blockers.push({
        type: 'missing_field',
        message: 'At least one dangerous substance must be identified',
      });
    }

    const zones = answers?.zones;
    const noZonedAreas = answers?.no_zoned_areas === true;
    if ((!zones || zones.length === 0) && !noZonedAreas) {
      blockers.push({
        type: 'missing_field',
        message: 'Zone classification must be documented OR confirm no zoned areas',
      });
    }

    const hasActions = actions && actions.filter(a => a.status !== 'closed').length > 0;
    const controlsAdequate = answers?.controls_adequate_confirmed === true;
    if (!hasActions && !controlsAdequate) {
      blockers.push({
        type: 'no_recommendations',
        message: 'Must have actions OR confirm controls are adequate',
      });
    }
  }

  return {
    eligible: blockers.length === 0,
    blockers,
  };
}

function getRequiredModules(type: SurveyType, ctx: IssueCtx): string[] {
  const common = [
    MODULE_KEYS.survey_info,
    MODULE_KEYS.property_details,
    MODULE_KEYS.persons_at_risk,
  ];

  if (type === 'FRA') {
    return [
      ...common,
      MODULE_KEYS.management,
      MODULE_KEYS.emergency_arrangements,
      MODULE_KEYS.hazards,
      MODULE_KEYS.means_of_escape,
      MODULE_KEYS.fire_protection,
      MODULE_KEYS.significant_findings,
    ];
  }

  if (type === 'FSD') {
    const modules = [
      ...common,
      MODULE_KEYS.regulatory_basis,
      MODULE_KEYS.evacuation_strategy,
      MODULE_KEYS.escape_design,
      MODULE_KEYS.passive_protection,
      MODULE_KEYS.active_systems,
      MODULE_KEYS.frs_access,
    ];

    if (ctx.smoke_control_applicable) {
      modules.push(MODULE_KEYS.smoke_control);
    }

    return modules;
  }

  if (type === 'DSEAR') {
    return [
      ...common,
      MODULE_KEYS.dangerous_substances,
      MODULE_KEYS.process_releases,
      MODULE_KEYS.hazardous_area_classification,
      MODULE_KEYS.ignition_sources,
      MODULE_KEYS.explosion_protection,
      MODULE_KEYS.risk_assessment_table,
      MODULE_KEYS.hierarchy_of_control,
      MODULE_KEYS.explosion_emergency,
    ];
  }

  return common;
}
