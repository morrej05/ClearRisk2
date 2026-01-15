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

    const systemPrompt = `You are a professional risk engineering assistant. Your role is to analyze portfolio metrics and provide clear, actionable executive summaries.

When provided with portfolio metrics, generate a concise 1-2 paragraph executive summary that:
- Highlights the overall portfolio risk profile
- Identifies key trends and patterns in the risk distribution
- Notes the best and worst performing sites
- Provides a professional assessment suitable for senior management

Keep the tone professional, objective, and focused on actionable insights.`;

    const userPrompt = `Please generate an executive summary for the following portfolio metrics:

${JSON.stringify(portfolioMetrics, null, 2)}

Provide a 1-2 paragraph executive summary that captures the key insights from this data.`;

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
