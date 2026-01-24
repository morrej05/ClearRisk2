import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CreateRevisionRequest {
  survey_id: string;
  note?: string;
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

    const body: CreateRevisionRequest = await req.json();
    const { survey_id, note } = body;

    if (!survey_id) {
      return new Response(
        JSON.stringify({ error: 'survey_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 1. Load survey and verify ownership
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

    // 2. Check if survey is issued (required to create revision)
    if (survey.status !== 'issued' && !survey.issued) {
      return new Response(
        JSON.stringify({ error: 'Survey must be issued before creating a revision' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Determine new revision number
    const currentRevision = survey.current_revision || 1;
    const newRevisionNumber = currentRevision + 1;

    // 4. Find the last issued revision snapshot
    const { data: lastRevision, error: revisionError } = await supabase
      .from('survey_revisions')
      .select('*')
      .eq('survey_id', survey_id)
      .eq('status', 'issued')
      .order('revision_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (revisionError) {
      console.error('Error fetching last revision:', revisionError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch revision history' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!lastRevision) {
      return new Response(
        JSON.stringify({ error: 'No issued revision found. Cannot create revision without baseline.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 5. Create new draft revision record (baseline copy)
    const { data: newRevision, error: createRevisionError } = await supabase
      .from('survey_revisions')
      .insert({
        survey_id: survey_id,
        revision_number: newRevisionNumber,
        status: 'draft',
        created_by: user.id,
        snapshot: lastRevision.snapshot,
      })
      .select()
      .single();

    if (createRevisionError) {
      console.error('Error creating revision:', createRevisionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create revision', details: createRevisionError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 6. Copy forward answers from snapshot to live editable store
    const previousAnswers = lastRevision.snapshot?.answers || survey.form_data || {};

    const { error: updateSurveyError } = await supabase
      .from('survey_reports')
      .update({
        status: 'draft',
        current_revision: newRevisionNumber,
        issued: false,
        issue_date: null,
        form_data: previousAnswers,
        change_log: note || `Revision ${newRevisionNumber} created from v${currentRevision}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', survey_id);

    if (updateSurveyError) {
      console.error('Error updating survey:', updateSurveyError);
      return new Response(
        JSON.stringify({ error: 'Failed to update survey', details: updateSurveyError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 7. Carry forward open actions
    const { data: openActions } = await supabase
      .from('actions')
      .select('*')
      .eq('document_id', survey_id)
      .eq('status', 'open')
      .is('deleted_at', null);

    if (openActions && openActions.length > 0) {
      const carriedActions = openActions.map((action: any) => ({
        organisation_id: action.organisation_id,
        document_id: survey_id,
        module_instance_id: action.module_instance_id,
        recommended_action: action.recommended_action,
        owner_user_id: action.owner_user_id,
        target_date: action.target_date,
        status: 'open',
        priority_band: action.priority_band,
        timescale: action.timescale,
        source: 'carried_forward',
        origin_action_id: action.id,
        carried_from_document_id: survey_id,
        source_document_id: survey_id,
      }));

      const { error: actionsError } = await supabase
        .from('actions')
        .insert(carriedActions);

      if (actionsError) {
        console.error('Warning: Failed to carry forward actions:', actionsError);
      }
    }

    // 8. Carry forward open recommendations from survey_recommendations table
    const { data: openSurveyRecommendations } = await supabase
      .from('survey_recommendations')
      .select('*')
      .eq('survey_id', survey_id)
      .eq('status', 'open');

    if (openSurveyRecommendations && openSurveyRecommendations.length > 0) {
      const carriedSurveyRecs = openSurveyRecommendations.map((rec: any) => ({
        survey_id: survey_id,
        template_id: rec.template_id,
        title_final: rec.title_final,
        body_final: rec.body_final,
        priority: rec.priority,
        status: 'open',
        owner: rec.owner,
        target_date: rec.target_date,
        source: rec.source,
        section_key: rec.section_key,
        sort_index: rec.sort_index,
        include_in_report: rec.include_in_report,
        revision_number: newRevisionNumber,
      }));

      const { error: surveyRecError } = await supabase
        .from('survey_recommendations')
        .insert(carriedSurveyRecs);

      if (surveyRecError) {
        console.error('Warning: Failed to carry forward survey_recommendations:', surveyRecError);
      }
    }

    // Also carry forward from legacy recommendations table if exists
    const { data: openRecommendations } = await supabase
      .from('recommendations')
      .select('*')
      .eq('survey_id', survey_id)
      .neq('status', 'completed')
      .is('revision_number', null);

    if (openRecommendations && openRecommendations.length > 0) {
      const carriedRecommendations = openRecommendations.map((rec: any) => ({
        survey_id: survey_id,
        title: rec.title,
        description: rec.description,
        hazard: rec.hazard,
        risk_dimension: rec.risk_dimension,
        priority: rec.priority,
        status: rec.status,
        revision_number: newRevisionNumber,
        order_index: rec.order_index,
      }));

      const { error: recError } = await supabase
        .from('recommendations')
        .insert(carriedRecommendations);

      if (recError) {
        console.error('Warning: Failed to carry forward recommendations:', recError);
      }
    }

    // 9. Return success
    return new Response(
      JSON.stringify({
        success: true,
        survey_id: survey_id,
        revision_number: newRevisionNumber,
        previous_revision: currentRevision,
        message: `Revision ${newRevisionNumber} created successfully`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in create-revision function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
