import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SaveRequest {
  recommendation_id: string;
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

// Normalize module keys to canonical form (e.g., RE_03_OCCUPANCY → RE03)
function normalizeModuleKey(key: string): string {
  const reMatch = key.match(/RE[_\s-]?(\d{2})/i);
  if (reMatch) {
    return `RE${reMatch[1]}`;
  }

  const legacyMap: Record<string, string> = {
    construction: "RE02",
    occupancy: "RE03",
    fire_protection: "RE04",
    exposures: "RE07",
    natural_hazards: "RE07",
    utilities: "RE08",
    electrical_and_utilities_reliability: "RE08",
    management: "RE09",
    process_control_and_stability: "RE10",
    safety_and_control_systems: "RE10",
    flammable_liquids_and_fire_risk: "RE10",
    emergency_response: "RE09",
  };

  const normalized = key.toLowerCase().replace(/[_\s-]+/g, "_");
  return legacyMap[normalized] || key;
}

// Generate action required text if missing
function generateActionRequired(title: string, observation: string): string {
  const lowerTitle = title.toLowerCase();
  const lowerObs = observation.toLowerCase();

  if (lowerTitle.includes("improve") || lowerObs.includes("inadequate") || lowerObs.includes("insufficient")) {
    return `Improve the identified condition to meet required standards.`;
  }
  if (lowerTitle.includes("install") || lowerObs.includes("missing") || lowerObs.includes("absent")) {
    return `Install appropriate controls to address the identified gap.`;
  }
  if (lowerTitle.includes("upgrade") || lowerObs.includes("outdated") || lowerObs.includes("aged")) {
    return `Upgrade the system to current standards and best practice.`;
  }
  if (lowerTitle.includes("maintain") || lowerObs.includes("maintenance")) {
    return `Implement regular maintenance program to sustain system reliability.`;
  }
  if (lowerTitle.includes("train") || lowerObs.includes("training")) {
    return `Provide comprehensive training to relevant personnel.`;
  }
  if (lowerTitle.includes("document") || lowerObs.includes("procedure")) {
    return `Develop and implement appropriate documentation and procedures.`;
  }

  return `Address the identified condition to reduce risk exposure.`;
}

// Generate hazard/risk description
function generateHazardText(observation: string, actionRequired: string): string {
  if (!observation && !actionRequired) {
    return "Inadequate controls increase the likelihood of loss events escalating beyond planned defenses. Foreseeable incidents could develop faster than current safeguards allow, increasing damage extent and recovery time. Strengthening this control reduces overall facility risk.";
  }

  const lowerAction = actionRequired.toLowerCase();

  // Consequence mapping
  let consequence = "Unaddressed conditions increase the likelihood of loss events escalating beyond planned safeguards, extending recovery timeframes.";
  if (lowerAction.includes("fire") || lowerAction.includes("flame") || lowerAction.includes("combusti")) {
    consequence = "Fire events could escalate beyond planned containment measures, increasing potential damage extent and recovery duration.";
  } else if (lowerAction.includes("water") || lowerAction.includes("leak") || lowerAction.includes("flood")) {
    consequence = "Water damage events could spread beyond initial affected areas, increasing downtime and restoration complexity.";
  } else if (lowerAction.includes("structural") || lowerAction.includes("building") || lowerAction.includes("construction")) {
    consequence = "Structural inadequacies could compromise the integrity of adjacent systems during stress events, amplifying loss severity.";
  } else if (lowerAction.includes("evacuation") || lowerAction.includes("egress") || lowerAction.includes("escape") || lowerAction.includes("life safety")) {
    consequence = "Evacuation delays during emergency scenarios could increase occupant exposure to hazardous conditions.";
  } else if (lowerAction.includes("electrical") || lowerAction.includes("power") || lowerAction.includes("circuit")) {
    consequence = "Electrical fault scenarios could propagate beyond the point of origin, affecting critical operations and increasing downtime.";
  } else if (lowerAction.includes("procedure") || lowerAction.includes("training") || lowerAction.includes("management") || lowerAction.includes("document")) {
    consequence = "Procedural gaps reduce organizational preparedness, potentially slowing response effectiveness during emerging incidents.";
  }

  // Benefit mapping
  let benefit = "Addressing this recommendation reduces overall facility risk exposure and enhances operational continuity.";
  if (lowerAction.includes("install") || lowerAction.includes("implement") || lowerAction.includes("add")) {
    benefit = "Implementation of the recommended control strengthens overall facility resilience and reduces loss potential.";
  } else if (lowerAction.includes("upgrade") || lowerAction.includes("replace") || lowerAction.includes("improve")) {
    benefit = "Upgrading this system enhances protective capabilities and reduces vulnerability to foreseeable scenarios.";
  } else if (lowerAction.includes("maintain") || lowerAction.includes("inspect") || lowerAction.includes("test")) {
    benefit = "Regular maintenance sustains protective system reliability and ensures readiness when needed.";
  } else if (lowerAction.includes("train") || lowerAction.includes("procedure") || lowerAction.includes("document")) {
    benefit = "Strengthening organizational preparedness improves response effectiveness and reduces incident duration.";
  }

  const lowerObs = observation.toLowerCase();
  let riskStatement = "Inadequate controls increase the likelihood of loss events escalating beyond planned defenses.";
  if (lowerObs.includes("inadequate") || lowerObs.includes("insufficient") || lowerObs.includes("lack of")) {
    riskStatement = "Current conditions with inadequate controls increase the likelihood of loss events escalating beyond planned defenses.";
  }

  return `${riskStatement} ${consequence} ${benefit}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    // Check platform admin status
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_platform_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_platform_admin) {
      throw new Error("Platform admin access required");
    }

    const { recommendation_id }: SaveRequest = await req.json();

    if (!recommendation_id) {
      throw new Error("No recommendation ID provided");
    }

    // Fetch recommendation
    const { data: recommendation, error: fetchError } = await supabase
      .from("re_recommendations")
      .select("id, title, observation_text, action_required_text, hazard_text, comments_text, priority, source_module_key")
      .eq("id", recommendation_id)
      .single();

    if (fetchError) throw fetchError;
    if (!recommendation) {
      throw new Error("Recommendation not found");
    }

    const rec = recommendation as ReRecommendation;

    // Populate fields with fallbacks
    const observation = rec.observation_text || "";
    const actionRequired = rec.action_required_text || generateActionRequired(rec.title, observation);
    const hazardText = rec.hazard_text || generateHazardText(observation, actionRequired);
    const normalizedModuleKey = normalizeModuleKey(rec.source_module_key);

    // Create normalized dedupe key
    const titleNorm = rec.title.toLowerCase().trim();
    const obsNorm = observation.toLowerCase().trim();
    const actionNorm = actionRequired.toLowerCase().trim();

    // Check for existing template with same content
    const { data: existingTemplates } = await supabase
      .from("recommendation_templates")
      .select("id, title, observation, action_required");

    const isDuplicate = existingTemplates?.some((t: any) => {
      const existingKey = `${(t.title || "").toLowerCase().trim()}|${(t.observation || "").toLowerCase().trim()}|${(t.action_required || "").toLowerCase().trim()}`;
      const newKey = `${titleNorm}|${obsNorm}|${actionNorm}`;
      return existingKey === newKey;
    });

    if (isDuplicate) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "A template with identical content already exists in the library",
          isDuplicate: true,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 409,
        }
      );
    }

    // Map priority
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

    // Map category
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
    };

    const template = {
      title: rec.title,
      body: `${observation} ${actionRequired}`.trim(),
      observation: observation,
      action_required: actionRequired,
      hazard_risk_description: hazardText,
      client_response_prompt: rec.comments_text || null,
      category: categoryMap[normalizedModuleKey] || "Other",
      default_priority: priorityMap[rec.priority] || 3,
      related_module_key: normalizedModuleKey,
      is_active: true,
      scope: "derived",
      tags: ["derived"],
      trigger_type: "manual",
      created_by: user.id,
    };

    const { error: insertError } = await supabase
      .from("recommendation_templates")
      .insert([template]);

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({
        success: true,
        message: "Recommendation saved to library",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
