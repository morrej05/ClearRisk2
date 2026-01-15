import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ActiveFilters {
  companyName: string | null;
  industrySector: string | null;
  framework: string | null;
}

interface PortfolioMetrics {
  portfolioContext?: {
    totalSurveys: number;
    dateRange?: {
      from: string;
      to: string;
    };
    filtersApplied: ActiveFilters;
  };
  riskProfile?: {
    averageRiskScore: number;
    overallRiskRating: 'Low' | 'Moderate' | 'High';
    riskScoreDistribution: {
      veryGood: number;
      good: number;
      tolerable: number;
      poor: number;
      veryPoor: number;
    };
  };
  constructionAndFireLoad?: {
    dominantConstructionTypes: Array<{ type: string; count: number; percentage: number }>;
    combustibilityStats: {
      averageCombustiblePercentage: number;
      sitesAbove25Percent: number;
      sitesAbove50Percent: number;
    };
  };
  protectionAndControls?: {
    automaticFireProtection: {
      averageSprinklerCoverage: number;
      sitesWithFullCoverage: number;
      sitesWithPartialCoverage: number;
      sitesWithNoCoverage: number;
    };
    fireDetection: {
      averageDetectionCoverage: number;
      sitesWithFullCoverage: number;
      sitesWithPartialCoverage: number;
      sitesWithNoCoverage: number;
    };
  };
  recommendationThemes?: {
    totalRecommendations: number;
    averageRecommendationsPerSite: number;
    topCategories: Array<{ category: string; count: number; percentage: number }>;
    highPriorityCount: number;
  };
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

    const systemPrompt = `You are a professional risk engineering assistant specializing in portfolio-level fire risk analysis. You produce executive-level portfolio summaries based only on structured, aggregated risk metrics.

CRITICAL RULES:
- Use only the data provided in the portfolio metrics
- Do not invent site-level details or specific site names
- Do not make compliance statements or regulatory references
- Do not add recommendations beyond what the data shows
- If a metric section is missing, do not reference it
- Be factual, neutral, and data-driven`;

    const userPrompt = `Generate a concise executive portfolio summary based on the aggregated metrics below.

STRUCTURE YOUR SUMMARY AS FOLLOWS:

1. Portfolio Overview (1 sentence)
   - Number of sites analyzed and date range (if provided)
   - Applied filters (if any)

2. Risk Profile (2-3 sentences)
   - Average risk score and overall rating
   - Distribution across risk bands
   - Key risk trends

3. Construction & Fire Load (1-2 sentences, if data available)
   - Dominant construction types
   - Combustibility patterns

4. Protection & Controls (1-2 sentences, if data available)
   - Fire protection coverage statistics
   - Detection system deployment

5. Recommendation Themes (1-2 sentences, if data available)
   - Most frequent recommendation categories
   - High-priority items

REQUIREMENTS:
- Professional, neutral tone appropriate for senior management
- Data-driven: cite specific percentages and counts
- Total length: 2-3 paragraphs maximum
- No site-specific identifiers or names
- No regulatory or compliance language

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
