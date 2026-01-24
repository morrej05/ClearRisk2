import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SubmitForReviewRequest {
  survey_id: string;
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

    const body: SubmitForReviewRequest = await req.json();
    const { survey_id } = body;

    if (!survey_id) {
      return new Response(
        JSON.stringify({ error: 'survey_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch survey
    const { data: survey, error: surveyError } = await supabase
      .from('survey_reports')
      .select('id, user_id, status, organisation_id')
      .eq('id', survey_id)
      .maybeSingle();

    if (surveyError || !survey) {
      return new Response(
        JSON.stringify({ error: 'Survey not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify user has access (owns survey or is in same org)
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('organisation_id')
      .eq('id', user.id)
      .maybeSingle();

    if (survey.user_id !== user.id && userProfile) {
      // Check if survey user is in same org
      if (!survey.organisation_id || survey.organisation_id !== userProfile.organisation_id) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Check current status is 'draft'
    if (survey.status !== 'draft') {
      return new Response(
        JSON.stringify({
          error: 'Survey must be in draft status to submit for review',
          current_status: survey.status,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Update survey status to 'in_review'
    const { error: updateError } = await supabase
      .from('survey_reports')
      .update({
        status: 'in_review',
        updated_at: new Date().toISOString(),
      })
      .eq('id', survey_id);

    if (updateError) {
      console.error('Error updating survey status:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update survey status' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Write audit log entry
    const { error: auditError } = await supabase
      .from('audit_log')
      .insert({
        organisation_id: survey.organisation_id || userProfile?.organisation_id,
        survey_id: survey.id,
        actor_id: user.id,
        event_type: 'submitted_for_review',
        details: {
          previous_status: 'draft',
          new_status: 'in_review',
        },
      });

    if (auditError) {
      console.error('Error writing audit log:', auditError);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        survey_id: survey.id,
        status: 'in_review',
        message: 'Survey submitted for review',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in submit-for-review:', error);
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
