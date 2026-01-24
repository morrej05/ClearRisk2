import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CloneSurveyRequest {
  source_survey_id: string;
  copy_answers?: boolean;
  copy_actions?: boolean;
}

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

    const body: CloneSurveyRequest = await req.json();
    const { source_survey_id, copy_answers = true, copy_actions = false } = body;

    if (!source_survey_id) {
      return new Response(
        JSON.stringify({ error: 'source_survey_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 1. Load source survey
    const { data: sourceSurvey, error: sourceError } = await supabase
      .from('survey_reports')
      .select('*')
      .eq('id', source_survey_id)
      .maybeSingle();

    if (sourceError || !sourceSurvey) {
      return new Response(
        JSON.stringify({ error: 'Source survey not found or access denied' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Permission check: User must have view access to source survey
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('organisation_id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (!userProfile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check access: User must be in same org as source survey
    if (sourceSurvey.organisation_id && sourceSurvey.organisation_id !== userProfile.organisation_id) {
      return new Response(
        JSON.stringify({ error: 'Access denied to source survey' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Create new survey row
    const now = new Date().toISOString();
    const newSurveyData = {
      organisation_id: sourceSurvey.organisation_id,
      user_id: user.id,
      survey_type: sourceSurvey.survey_type,
      document_type: sourceSurvey.document_type,
      status: 'draft',
      current_revision: 1,

      // Copy site/property metadata
      site_name: sourceSurvey.site_name,
      site_address: sourceSurvey.site_address,
      site_postcode: sourceSurvey.site_postcode,
      latitude: sourceSurvey.latitude,
      longitude: sourceSurvey.longitude,

      // Copy scope defaults
      scope_type: sourceSurvey.scope_type,
      engineered_solutions_used: sourceSurvey.engineered_solutions_used,

      // Copy answers if requested
      form_data: copy_answers ? sourceSurvey.form_data : {},

      // Fresh state
      issued: false,
      issue_date: null,
      issued_by: null,
      approved_at: null,
      approved_by: null,
      approval_note: null,
      change_log: null,

      created_at: now,
      updated_at: now,
    };

    const { data: newSurvey, error: createError } = await supabase
      .from('survey_reports')
      .insert(newSurveyData)
      .select()
      .single();

    if (createError) {
      console.error('Error creating cloned survey:', createError);
      return new Response(
        JSON.stringify({ error: 'Failed to clone survey', details: createError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. Copy module instances if they exist
    if (copy_answers) {
      const { data: sourceModules } = await supabase
        .from('module_instances')
        .select('*')
        .eq('document_id', source_survey_id);

      if (sourceModules && sourceModules.length > 0) {
        const newModules = sourceModules.map((mod: any) => ({
          document_id: newSurvey.id,
          module_key: mod.module_key,
          payload: mod.payload,
          completed_at: null,
          created_at: now,
          updated_at: now,
        }));

        const { error: moduleError } = await supabase
          .from('module_instances')
          .insert(newModules);

        if (moduleError) {
          console.error('Error copying modules:', moduleError);
        }
      }
    }

    // 5. Copy open actions if requested
    if (copy_actions) {
      const { data: openActions } = await supabase
        .from('recommendations')
        .select('*')
        .eq('survey_id', source_survey_id)
        .eq('status', 'open');

      if (openActions && openActions.length > 0) {
        const newActions = openActions.map((action: any) => ({
          survey_id: newSurvey.id,
          revision_number: 1,
          title: action.title,
          description: action.description,
          priority: action.priority,
          category: action.category,
          status: 'open',
          source: 'cloned',
          owner_id: user.id,
          created_at: now,
          updated_at: now,
        }));

        const { error: actionsError } = await supabase
          .from('recommendations')
          .insert(newActions);

        if (actionsError) {
          console.error('Error copying actions:', actionsError);
        }
      }
    }

    // 6. Write audit log for source survey (documenting the clone)
    const { error: auditError } = await supabase
      .from('audit_log')
      .insert({
        organisation_id: sourceSurvey.organisation_id,
        survey_id: source_survey_id,
        actor_id: user.id,
        event_type: 'survey_cloned',
        details: {
          new_survey_id: newSurvey.id,
          copied_answers: copy_answers,
          copied_actions: copy_actions,
        },
      });

    if (auditError) {
      console.error('Error writing audit log:', auditError);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        new_survey_id: newSurvey.id,
        message: 'Survey cloned successfully',
        copied: {
          answers: copy_answers,
          actions: copy_actions,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in clone-survey:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
