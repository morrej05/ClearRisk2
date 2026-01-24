import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import JSZip from 'npm:jszip@3.10.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CompliancePackRequest {
  survey_id: string;
  revision_number: number;
}

interface Action {
  id: string;
  title_final?: string;
  hazard?: string;
  description_final?: string;
  action_final?: string;
  priority?: number;
  status?: string;
  owner?: string;
  target_date?: string;
  created_at?: string;
  created_by?: string;
  closed_at?: string;
  closed_by?: string;
  closure_note?: string;
  reopened_at?: string;
  reopened_by?: string;
  reopen_note?: string;
}

interface AuditLogEntry {
  created_at: string;
  event_type: string;
  revision_number?: number;
  actor_id: string;
  actor_name?: string;
  details: any;
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

    const body: CompliancePackRequest = await req.json();
    const { survey_id, revision_number } = body;

    if (!survey_id || !revision_number) {
      return new Response(
        JSON.stringify({ error: 'survey_id and revision_number are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Load the revision
    const { data: revision, error: revisionError } = await supabase
      .from('survey_revisions')
      .select('id, survey_id, revision_number, status, snapshot, pdf_path, issued_at, issued_by')
      .eq('survey_id', survey_id)
      .eq('revision_number', revision_number)
      .maybeSingle();

    if (revisionError) {
      console.error('Error loading revision:', revisionError);
      return new Response(
        JSON.stringify({ error: 'Failed to load revision' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!revision) {
      return new Response(
        JSON.stringify({ error: 'Revision not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Only allow compliance pack for issued revisions
    if (revision.status !== 'issued') {
      return new Response(
        JSON.stringify({ error: 'Compliance pack is only available for issued revisions' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check user has access to this survey
    const { data: survey, error: surveyError } = await supabase
      .from('survey_reports')
      .select('id, user_id')
      .eq('id', survey_id)
      .maybeSingle();

    if (surveyError || !survey) {
      return new Response(
        JSON.stringify({ error: 'Survey not found or access denied' }),
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
      const { data: surveyUserProfile } = await supabase
        .from('user_profiles')
        .select('organisation_id')
        .eq('id', survey.user_id)
        .maybeSingle();

      if (!surveyUserProfile || surveyUserProfile.organisation_id !== userProfile.organisation_id) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Create ZIP
    const zip = new JSZip();

    // 1. Add the issued PDF
    if (revision.pdf_path) {
      try {
        const { data: pdfData, error: pdfError } = await supabase.storage
          .from('survey-pdfs')
          .download(revision.pdf_path);

        if (!pdfError && pdfData) {
          const pdfBytes = await pdfData.arrayBuffer();
          zip.file(`issued-report-v${revision_number}.pdf`, pdfBytes);
        } else {
          console.warn('PDF not found in storage:', revision.pdf_path);
        }
      } catch (error) {
        console.error('Error loading PDF:', error);
      }
    }

    // 2. Generate Actions Register CSV
    let actions: Action[] = [];

    // Try to get actions from snapshot first
    if (revision.snapshot?.actions && Array.isArray(revision.snapshot.actions)) {
      actions = revision.snapshot.actions;
    } else {
      // Fallback: query actions table
      const { data: actionsData } = await supabase
        .from('survey_recommendations')
        .select('*')
        .eq('survey_id', survey_id)
        .order('created_at', { ascending: true });

      if (actionsData) {
        actions = actionsData;
      }
    }

    const actionsCsv = generateActionsCsv(actions);
    zip.file(`actions-register-v${revision_number}.csv`, actionsCsv);

    // 3. Generate Audit Trail CSV
    const { data: auditEntries } = await supabase
      .from('audit_log')
      .select(`
        created_at,
        event_type,
        revision_number,
        actor_id,
        details
      `)
      .eq('survey_id', survey_id)
      .order('created_at', { ascending: true });

    // Fetch actor names for audit trail
    const actorIds = [...new Set((auditEntries || []).map(e => e.actor_id).filter(Boolean))];
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, name')
      .in('id', actorIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);

    const auditEntriesWithNames = (auditEntries || []).map(entry => ({
      ...entry,
      actor_name: profileMap.get(entry.actor_id) || 'Unknown',
    }));

    const auditCsv = generateAuditCsv(auditEntriesWithNames);
    zip.file(`audit-trail-v${revision_number}.csv`, auditCsv);

    // Generate ZIP file
    const zipBlob = await zip.generateAsync({ type: 'uint8array' });

    // Store ZIP in Supabase Storage
    const zipPath = `compliance/${survey_id}/rev-${revision_number}/compliance-pack.zip`;

    const { error: uploadError } = await supabase.storage
      .from('survey-pdfs')
      .upload(zipPath, zipBlob, {
        contentType: 'application/zip',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading ZIP:', uploadError);
      // Return ZIP directly if upload fails
      return new Response(zipBlob, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="compliance-pack-${survey_id}-v${revision_number}.zip"`,
        },
      });
    }

    // Generate signed URL (expires in 10 minutes)
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('survey-pdfs')
      .createSignedUrl(zipPath, 600);

    if (urlError || !signedUrlData) {
      console.error('Error creating signed URL:', urlError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate download URL' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        download_url: signedUrlData.signedUrl,
        expires_in: 600,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error generating compliance pack:', error);
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

function generateActionsCsv(actions: Action[]): string {
  const headers = [
    'ID',
    'Title',
    'Hazard',
    'Description',
    'Action Required',
    'Priority',
    'Status',
    'Owner',
    'Target Date',
    'Created At',
    'Created By',
    'Closed At',
    'Closed By',
    'Closure Note',
    'Reopened At',
    'Reopened By',
    'Reopen Note',
  ];

  const rows = actions.map(action => [
    action.id || '',
    escapeCsv(action.title_final || ''),
    escapeCsv(action.hazard || ''),
    escapeCsv(action.description_final || ''),
    escapeCsv(action.action_final || ''),
    action.priority?.toString() || '',
    action.status || 'open',
    escapeCsv(action.owner || ''),
    action.target_date || '',
    action.created_at || '',
    action.created_by || '',
    action.closed_at || '',
    action.closed_by || '',
    escapeCsv(action.closure_note || ''),
    action.reopened_at || '',
    action.reopened_by || '',
    escapeCsv(action.reopen_note || ''),
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

function generateAuditCsv(entries: AuditLogEntry[]): string {
  const headers = [
    'Created At',
    'Event Type',
    'Revision Number',
    'Actor ID',
    'Actor Name',
    'Details',
  ];

  const rows = entries.map(entry => [
    entry.created_at || '',
    entry.event_type || '',
    entry.revision_number?.toString() || '',
    entry.actor_id || '',
    escapeCsv(entry.actor_name || ''),
    escapeCsv(JSON.stringify(entry.details || {})),
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

function escapeCsv(value: string): string {
  if (!value) return '';

  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}
