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

interface ValidationResult {
  eligible: boolean;
  blockers: Array<{
    type: string;
    moduleKey?: string;
    fieldKey?: string;
    message: string;
  }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Get auth header
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

    // Create Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user from auth header
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

    // Parse request body
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

    // 1. Fetch survey with all related data
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

    // 2. Check if already issued
    if (survey.issued) {
      return new Response(
        JSON.stringify({ error: 'Survey is already issued' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Fetch module completion status
    const { data: sections, error: sectionsError } = await supabase
      .from('survey_sections')
      .select('*')
      .eq('survey_id', survey_id);

    // Build module progress map
    const moduleProgress: Record<string, 'complete' | 'incomplete'> = {};
    sections?.forEach((section: any) => {
      moduleProgress[section.section_code] = section.section_complete ? 'complete' : 'incomplete';
    });

    // 4. Fetch actions/recommendations
    const { data: actions, error: actionsError } = await supabase
      .from('recommendations')
      .select('*')
      .eq('survey_id', survey_id);

    // 5. Server-side validation
    const validation = await validateSurvey(survey, moduleProgress, actions || []);

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

    // 6. Determine revision number
    const current_revision = survey.current_revision || 1;
    const revision_number = current_revision;

    // 7. Create revision snapshot
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
      sections: sections || [],
      issued_confirmed: survey.issued_confirmed || false,
      change_log: change_log || 'Initial issue',
    };

    // 8. Insert revision record
    const { data: revision, error: revisionError } = await supabase
      .from('survey_revisions')
      .insert({
        survey_id: survey_id,
        revision_number: revision_number,
        status: 'issued',
        snapshot: snapshot,
        issued_at: new Date().toISOString(),
        issued_by: user.id,
        created_by: user.id,
      })
      .select()
      .single();

    if (revisionError) {
      console.error('Error creating revision:', revisionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create revision' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 9. Update survey to issued status
    const { error: updateError } = await supabase
      .from('survey_reports')
      .update({
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
        JSON.stringify({ error: 'Failed to update survey' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 10. Return success
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

/**
 * Server-side validation logic
 */
async function validateSurvey(
  survey: any,
  moduleProgress: Record<string, 'complete' | 'incomplete'>,
  actions: any[]
): Promise<ValidationResult> {
  const blockers: any[] = [];

  // Check confirmed flag
  if (!survey.issued_confirmed) {
    blockers.push({
      type: 'confirm_missing',
      message: 'Assessor must confirm completeness before issuing',
    });
  }

  // Basic module completion checks
  const requiredModules = getRequiredModulesForType(survey.document_type);

  for (const moduleKey of requiredModules) {
    if (moduleProgress[moduleKey] !== 'complete') {
      blockers.push({
        type: 'module_incomplete',
        moduleKey: moduleKey,
        message: `Module ${moduleKey} must be completed`,
      });
    }
  }

  // Type-specific validation
  if (survey.document_type === 'FRA') {
    // Check scope limitations for limited/desktop
    if (['limited', 'desktop'].includes(survey.scope_type) && !survey.scope_limitations?.trim()) {
      blockers.push({
        type: 'conditional_missing',
        moduleKey: 'survey_info',
        message: 'Scope limitations required for limited/desktop assessments',
      });
    }

    // Check recommendations exist
    if (!actions || actions.length === 0) {
      const formData = survey.form_data || {};
      if (!formData.no_significant_findings) {
        blockers.push({
          type: 'no_recommendations',
          message: 'Must have recommendations OR confirm no significant findings',
        });
      }
    }
  }

  if (survey.document_type === 'FSD') {
    if (survey.engineered_solutions_used) {
      const formData = survey.form_data || {};
      if (!formData.limitations_reliance?.limitations_text?.trim()) {
        blockers.push({
          type: 'conditional_missing',
          message: 'Limitations required when using engineered solutions',
        });
      }
    }
  }

  if (survey.document_type === 'DSEAR') {
    const formData = survey.form_data || {};
    if (!formData.substances?.substance_list || formData.substances.substance_list.length === 0) {
      blockers.push({
        type: 'missing_field',
        message: 'At least one dangerous substance must be identified',
      });
    }
  }

  return {
    eligible: blockers.length === 0,
    blockers,
  };
}

/**
 * Get required module keys by survey type
 */
function getRequiredModulesForType(documentType: string): string[] {
  switch (documentType) {
    case 'FRA':
      return [
        'survey_info',
        'property_details',
        'construction',
        'occupancy',
        'hazards',
        'fire_protection',
        'management',
        'risk_evaluation',
        'recommendations',
      ];
    case 'FSD':
      return [
        'strategy_scope_basis',
        'building_description',
        'occupancy_fire_load',
        'means_of_escape',
        'compartmentation',
        'detection_alarm',
      ];
    case 'DSEAR':
      return [
        'assessment_scope',
        'substances',
        'processes',
        'hazardous_area_classification',
        'ignition_sources',
        'control_measures',
        'equipment_compliance',
        'management_controls',
        'risk_evaluation',
        'actions',
      ];
    default:
      return [];
  }
}
