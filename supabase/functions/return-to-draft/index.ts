import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ReturnToDraftRequest {
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

    const body: ReturnToDraftRequest = await req.json();
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
      .select('organisation_id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (!userProfile || userProfile.role !== 'org_admin') {
      return new Response(
        JSON.stringify({ error: 'Only organization admins can return surveys to draft' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch survey
    const { data: survey, error: surveyError } = await supabase
      .from('survey_reports')
      .select('id, user_id, status, organisation_id, approved_at, approved_by')
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

    // Check current status is 'in_review' or 'approved'
    if (survey.status !== 'in_review' && survey.status !== 'approved') {
      return new Response(
        JSON.stringify({
          error: 'Survey must be in review or approved status to return to draft',
          current_status: survey.status,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const previousStatus = survey.status;

    // Update survey status to 'draft' and clear approval metadata
    const { error: updateError } = await supabase
      .from('survey_reports')
      .update({
        status: 'draft',
        approved_at: null,
        approved_by: null,
        approval_note: null,
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
        organisation_id: survey.organisation_id,
        survey_id: survey.id,
        actor_id: user.id,
        event_type: 'returned_to_draft',
        details: {
          previous_status: previousStatus,
          new_status: 'draft',
          note: note || null,
          cleared_approval: previousStatus === 'approved',
        },
      });

    if (auditError) {
      console.error('Error writing audit log:', auditError);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        survey_id: survey.id,
        status: 'draft',
        message: 'Survey returned to draft',
        note: note,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in return-to-draft:', error);
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
