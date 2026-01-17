import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CSVRow {
  hazard: string;
  description: string;
  action: string;
  client_response_prompt: string;
  category: string;
  default_priority: number;
  is_active: boolean;
  scope: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!superAdmin) {
      return new Response(
        JSON.stringify({ error: 'Only super admins can seed templates' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { csvData } = await req.json();

    if (!csvData || !Array.isArray(csvData)) {
      return new Response(
        JSON.stringify({ error: 'Invalid CSV data format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const row of csvData) {
      try {
        const { data: existing } = await supabase
          .from('recommendation_templates')
          .select('id')
          .eq('scope', row.scope)
          .eq('hazard', row.hazard)
          .ilike('description', `${row.description.substring(0, 100)}%`)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from('recommendation_templates')
            .update({
              description: row.description,
              action: row.action,
              client_response_prompt: row.client_response_prompt,
              category: row.category,
              default_priority: row.default_priority,
              is_active: row.is_active
            })
            .eq('id', existing.id);

          if (error) {
            errors.push(`Update failed for "${row.hazard}": ${error.message}`);
            skippedCount++;
          } else {
            updatedCount++;
          }
        } else {
          const { error } = await supabase
            .from('recommendation_templates')
            .insert([{
              hazard: row.hazard,
              description: row.description,
              action: row.action,
              client_response_prompt: row.client_response_prompt,
              category: row.category,
              default_priority: row.default_priority,
              is_active: row.is_active,
              scope: row.scope
            }]);

          if (error) {
            errors.push(`Insert failed for "${row.hazard}": ${error.message}`);
            skippedCount++;
          } else {
            insertedCount++;
          }
        }
      } catch (err) {
        errors.push(`Error processing "${row.hazard}": ${err.message}`);
        skippedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: csvData.length,
          inserted: insertedCount,
          updated: updatedCount,
          skipped: skippedCount
        },
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Seed error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
