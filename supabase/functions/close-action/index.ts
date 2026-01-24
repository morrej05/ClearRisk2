import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CloseActionRequest {
  action_id: string;
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

    const body: CloseActionRequest = await req.json();
    const { action_id, note } = body;

    if (!action_id) {
      return new Response(
        JSON.stringify({ error: 'action_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Load the action/recommendation
    const { data: action, error: actionError } = await supabase
      .from('survey_recommendations')
      .select('id, survey_id, status')
      .eq('id', action_id)
      .maybeSingle();

    if (actionError) {
      console.error('Error loading action:', actionError);
      return new Response(
        JSON.stringify({ error: 'Failed to load action' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Action not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Load the survey to check status and permissions
    const { data: survey, error: surveyError } = await supabase
      .from('survey_reports')
      .select('id, status, organisation_id')
      .eq('id', action.survey_id)
      .maybeSingle();

    if (surveyError || !survey) {
      console.error('Error loading survey:', surveyError);
      return new Response(
        JSON.stringify({ error: 'Failed to load survey' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if survey is issued (locked)
    if (survey.status === 'issued') {
      return new Response(
        JSON.stringify({
          error: 'Survey is issued and locked. Create a revision to close actions.',
          locked: true
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check user permissions (must be in same org and have edit rights)
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('organisation_id, role, can_edit')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !userProfile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (userProfile.organisation_id !== survey.organisation_id) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (userProfile.role === 'viewer' || !userProfile.can_edit) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // If already closed, return success (idempotent)
    if (action.status === 'closed') {
      return new Response(
        JSON.stringify({ ok: true, already_closed: true }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Close the action
    const { error: updateError } = await supabase
      .from('survey_recommendations')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        closed_by: user.id,
        closure_note: note || null,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', action_id);

    if (updateError) {
      console.error('Error closing action:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to close action' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
