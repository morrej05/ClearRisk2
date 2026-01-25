import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface DeleteDocumentRequest {
  document_id: string;
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
        JSON.stringify({ error: 'Authorization header required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const body: DeleteDocumentRequest = await req.json();
    const { document_id } = body;

    if (!document_id) {
      return new Response(
        JSON.stringify({ error: 'document_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Load document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, status, issue_status, version_number, organisation_id, deleted_at, title')
      .eq('id', document_id)
      .maybeSingle();

    if (docError) {
      console.error('Error loading document:', docError);
      return new Response(
        JSON.stringify({ error: 'Failed to load document' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!document) {
      return new Response(
        JSON.stringify({ error: 'Document not found or access denied' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if already deleted (idempotent)
    if (document.deleted_at) {
      return new Response(
        JSON.stringify({ ok: true, message: 'Document already deleted' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // HARD RULE: Cannot delete issued documents
    if (document.issue_status === 'issued') {
      return new Response(
        JSON.stringify({
          error: 'Issued documents cannot be deleted. Create a revision if you need to make changes.',
          code: 'DOCUMENT_ISSUED',
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify user has permission (must be in same org)
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('organisation_id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (!userProfile || userProfile.organisation_id !== document.organisation_id) {
      return new Response(
        JSON.stringify({ error: 'Permission denied' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Perform soft delete
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
      })
      .eq('id', document_id);

    if (updateError) {
      console.error('Error deleting document:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete document' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create audit log entry
    try {
      await supabase.from('audit_log').insert({
        survey_id: document_id,
        actor_id: user.id,
        event_type: 'document_deleted',
        details: {
          status: document.status,
          issue_status: document.issue_status,
          version_number: document.version_number,
          title: document.title,
        },
      });
    } catch (auditError) {
      console.error('Failed to create audit log entry:', auditError);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: 'Document deleted successfully',
      }),
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
