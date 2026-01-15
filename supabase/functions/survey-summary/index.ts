import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SurveyData {
  propertyName: string;
  industrySector?: string;
  overallRiskScore?: number;
  riskBand?: string;
  siteCombustibilityPercentage?: number;
  buildings?: Array<{
    building_name: string;
    building_frame?: string;
    fire_protection?: {
      sprinkler_coverage_pct?: number;
      detection_coverage_pct?: number;
    };
  }>;
  recommendationCount?: number;
  highPriorityRecommendationCount?: number;
}

interface SummaryRequest {
  surveyData: SurveyData;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { surveyData }: SummaryRequest = await req.json();

    if (!surveyData || !surveyData.propertyName) {
      return new Response(
        JSON.stringify({ error: "surveyData with propertyName is required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const systemPrompt = `You are a professional fire risk engineering assistant. You produce concise, factual survey summaries based only on structured risk data provided.

CRITICAL RULES:
- Use only the structured data provided
- Do not invent details or make assumptions
- Do not include regulatory references or compliance statements
- Do not provide recommendations or advice
- Do not expand beyond what the data shows
- Be factual, neutral, and concise
- If a data field is missing, do not reference it`;

    const userPrompt = `Generate a single-paragraph executive summary for this fire risk survey.

SUMMARY STRUCTURE:
1. Site identification and industry sector (1 sentence)
2. Overall risk rating and score (1 sentence)
3. Key construction and fire protection characteristics (1-2 sentences)
4. Recommendation overview if present (1 sentence)

REQUIREMENTS:
- Professional, neutral tone
- Factual and data-driven
- Single paragraph, 4-6 sentences maximum
- No regulatory language
- No site-specific recommendations
- No creative expansion

Survey Data:
${JSON.stringify(surveyData, null, 2)}`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.5,
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
      }),
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      console.error("OpenAI API error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to generate summary with AI" }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const openaiData = await openaiResponse.json();
    const summary = openaiData.choices[0]?.message?.content;

    if (!summary) {
      return new Response(
        JSON.stringify({ error: "No summary returned from AI" }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: summary.trim(),
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in survey-summary:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
