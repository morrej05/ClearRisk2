import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PortfolioMetrics {
  averageScore: number;
  totalIssued: number;
  scoredReports: number;
  distribution: Record<string, number>;
  bestScore: number;
  worstScore: number;
  bestSite: string;
  worstSite: string;
  frameworkFilter?: string;
}

interface SummaryRequest {
  portfolioMetrics: PortfolioMetrics;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { portfolioMetrics }: SummaryRequest = await req.json();

    if (!portfolioMetrics) {
      return new Response(
        JSON.stringify({ error: "portfolioMetrics is required" }),
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

    const systemPrompt = `You are a professional risk engineering assistant. You produce executive-level portfolio summaries based only on structured, aggregated risk metrics. You must not invent site-level details, recommendations, or compliance statements. If information is not present in the input, do not infer it.`;

    const userPrompt = `Using the portfolio metrics below, generate a concise executive summary suitable for senior management.

The summary should:
- Describe the overall portfolio risk profile
- Highlight key concentrations of risk and recurring themes
- Indicate areas that may warrant prioritised attention
- Reflect trends where comparison data is provided

The summary must:
- Be neutral and professional in tone
- Be limited to 1–2 short paragraphs
- Refer only to portfolio-level trends
- Avoid compliance or site-specific language

Portfolio Metrics:
${JSON.stringify(portfolioMetrics, null, 2)}`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        max_tokens: 500,
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
    console.error("Error in generate-portfolio-summary:", error);
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
