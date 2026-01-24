import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import {
  assertActionSurveyEditable,
  SurveyLockedError,
  SurveyNotFoundError,
  createLockedSurveyResponse,
  createNotFoundResponse
} from '../_shared/surveyGuards.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ReopenActionRequest {
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

    const body: ReopenActionRequest = await req.json();
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

    // GUARD: Assert survey is editable (not issued)
    let survey;
    try {
      survey = await assertActionSurveyEditable(supabase, action_id);
    } catch (error) {
      if (error instanceof SurveyLockedError) {
        return createLockedSurveyResponse(corsHeaders);
      }
      if (error instanceof SurveyNotFoundError) {
        return createNotFoundResponse(corsHeaders);
      }
      console.error('Unexpected error in guard:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Load the action details
    const { data: action, error: actionError } = await supabase
      .from('survey_recommendations')
      .select('id, survey_id, status, title_final, hazard')
      .eq('id', action_id)
      .maybeSingle();

    if (actionError || !action) {
      console.error('Error loading action:', actionError);
      return new Response(
        JSON.stringify({ error: 'Action not found' }),
        {
          status: 404,
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

    // If already open, return success (idempotent)
    if (action.status === 'open') {
      return new Response(
        JSON.stringify({ ok: true, already_open: true }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Reopen the action
    // Keep closed_at/closed_by/closure_note for history
    // Add reopen tracking fields
    const { error: updateError } = await supabase
      .from('survey_recommendations')
      .update({
        status: 'open',
        reopened_at: new Date().toISOString(),
        reopened_by: user.id,
        reopen_note: note || null,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', action_id);

    if (updateError) {
      console.error('Error reopening action:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to reopen action' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Write audit log entry
    try {
      await supabase.from('audit_log').insert({
        organisation_id: survey.organisation_id || null,
        survey_id: action.survey_id,
        revision_number: survey.current_revision || 1,
        actor_id: user.id,
        event_type: 'action_reopened',
        details: {
          action_id: action_id,
          title: action.title_final || action.hazard || 'Untitled action',
          note: note || '',
        },
      });
    } catch (auditError) {
      console.error('Warning: Failed to write audit log:', auditError);
      // Don't fail the operation if audit logging fails
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
