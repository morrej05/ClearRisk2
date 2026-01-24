import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ApproveSurveyRequest {
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

    const body: ApproveSurveyRequest = await req.json();
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

    // Check if user is org admin
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('organisation_id, role, name')
      .eq('id', user.id)
      .maybeSingle();

    if (!userProfile || userProfile.role !== 'org_admin') {
      return new Response(
        JSON.stringify({ error: 'Only organization admins can approve surveys' }),
        {
          status: 403,
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

    // Verify survey is in same org
    if (survey.organisation_id !== userProfile.organisation_id) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check current status is 'in_review'
    if (survey.status !== 'in_review') {
      return new Response(
        JSON.stringify({
          error: 'Survey must be in review status to approve',
          current_status: survey.status,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const now = new Date().toISOString();

    // Update survey status to 'approved' and set approval metadata
    const { error: updateError } = await supabase
      .from('survey_reports')
      .update({
        status: 'approved',
        approved_at: now,
        approved_by: user.id,
        approval_note: note || null,
        updated_at: now,
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
        organisation_id: survey.organisation_id,
        survey_id: survey.id,
        actor_id: user.id,
        event_type: 'approved',
        details: {
          previous_status: 'in_review',
          new_status: 'approved',
          note: note || null,
          approver_name: userProfile.name,
        },
      });

    if (auditError) {
      console.error('Error writing audit log:', auditError);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        survey_id: survey.id,
        status: 'approved',
        approved_at: now,
        approved_by: user.id,
        approval_note: note,
        message: 'Survey approved',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in approve-survey:', error);
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
