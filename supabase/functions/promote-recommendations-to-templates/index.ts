import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PromoteRequest {
  recommendation_ids: string[];
}

interface ReRecommendation {
  id: string;
  title: string;
  observation_text: string;
  action_required_text: string;
  hazard_text: string;
  comments_text: string | null;
  priority: string;
  source_module_key: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Verify platform admin
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_platform_admin")
      .eq("user_id", user.id)
      .single();

    if (!profile?.is_platform_admin) {
      throw new Error("Platform admin access required");
    }

    const { recommendation_ids }: PromoteRequest = await req.json();

    if (!recommendation_ids || recommendation_ids.length === 0) {
      throw new Error("No recommendation IDs provided");
    }

    // Fetch recommendations
    const { data: recommendations, error: fetchError } = await supabase
      .from("re_recommendations")
      .select("id, title, observation_text, action_required_text, hazard_text, comments_text, priority, source_module_key")
      .in("id", recommendation_ids);

    if (fetchError) throw fetchError;
    if (!recommendations || recommendations.length === 0) {
      throw new Error("No recommendations found");
    }

    // Fetch existing templates for deduplication
    const { data: existingTemplates } = await supabase
      .from("recommendation_templates")
      .select("title, observation");

    const existingKeys = new Set(
      (existingTemplates || []).map((t: any) => {
        const obsPrefix = (t.observation || "").substring(0, 50).toLowerCase().trim();
        return `${t.title.toLowerCase().trim()}|${obsPrefix}`;
      })
    );

    // Map priority text to numeric
    const priorityMap: Record<string, number> = {
      "1": 1,
      "2": 2,
      "3": 3,
      "4": 4,
      "5": 5,
      "Critical": 1,
      "High": 2,
      "Medium": 3,
      "Low": 4,
    };

    // Infer category from module key
    const categoryMap: Record<string, string> = {
      RE02: "Construction",
      RE03: "Construction",
      RE04: "Fire Protection & Detection",
      RE05: "Special Hazards",
      RE06: "Fire Protection & Detection",
      RE07: "Special Hazards",
      RE08: "Fire Protection & Detection",
      RE09: "Management Systems",
      RE10: "Special Hazards",
      RE11: "Business Continuity",
      RE12: "Business Continuity",
      // Legacy/alternative module keys
      construction: "Construction",
      occupancy: "Construction",
      fire_protection: "Fire Protection & Detection",
      exposures: "Special Hazards",
      utilities: "Fire Protection & Detection",
      management: "Management Systems",
      process_control_and_stability: "Special Hazards",
      safety_and_control_systems: "Fire Protection & Detection",
      flammable_liquids_and_fire_risk: "Special Hazards",
      emergency_response: "Management Systems",
    };

    const templatesToInsert = [];
    const skippedDuplicates = [];

    for (const rec of recommendations as ReRecommendation[]) {
      // Deduplication check
      const obsPrefix = (rec.observation_text || "").substring(0, 50).toLowerCase().trim();
      const key = `${rec.title.toLowerCase().trim()}|${obsPrefix}`;

      if (existingKeys.has(key)) {
        skippedDuplicates.push(rec.title);
        continue;
      }

      // Map fields
      const template = {
        title: rec.title,
        body: `${rec.observation_text || ""} ${rec.action_required_text || ""}`.trim(),
        observation: rec.observation_text || "",
        action_required: rec.action_required_text || "",
        hazard_risk_description: rec.hazard_text || "Risk statement pending generation.",
        client_response_prompt: rec.comments_text || null,
        category: categoryMap[rec.source_module_key] || "Other",
        default_priority: priorityMap[rec.priority] || 3,
        related_module_key: rec.source_module_key,
        is_active: true,
        scope: "derived",
        tags: ["derived"],
        trigger_type: "manual",
        created_by: user.id,
      };

      templatesToInsert.push(template);
      existingKeys.add(key); // Prevent duplicates within the same batch
    }

    // Insert templates
    let insertedCount = 0;
    if (templatesToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("recommendation_templates")
        .insert(templatesToInsert);

      if (insertError) throw insertError;
      insertedCount = templatesToInsert.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted: insertedCount,
        skipped: skippedDuplicates.length,
        skipped_titles: skippedDuplicates,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Error promoting recommendations:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
