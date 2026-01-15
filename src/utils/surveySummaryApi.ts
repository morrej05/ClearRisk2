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

export async function generateSurveySummary(surveyData: SurveyData): Promise<string> {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/survey-summary`;

  const headers = {
    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ surveyData }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to generate survey summary');
  }

  const data = await response.json();
  return data.summary;
}

export function prepareSurveyDataForSummary(formData: any): SurveyData {
  const overallComments = formData?.overallComments || [];
  const highPriorityCount = overallComments.filter(
    (rec: any) => rec.priority === 'High' || rec.priority === 'Critical'
  ).length;

  return {
    propertyName: formData?.propertyName || 'Unnamed Site',
    industrySector: formData?.industrySector,
    overallRiskScore: formData?.overallRiskScore,
    riskBand: formData?.riskBand,
    siteCombustibilityPercentage: formData?.siteCombustibilityPercentage,
    buildings: formData?.buildings?.map((building: any) => ({
      building_name: building.building_name,
      building_frame: building.building_frame,
      fire_protection: {
        sprinkler_coverage_pct: building.fire_protection?.sprinkler_coverage_pct,
        detection_coverage_pct: building.fire_protection?.detection_coverage_pct,
      },
    })),
    recommendationCount: overallComments.length,
    highPriorityRecommendationCount: highPriorityCount,
  };
}
