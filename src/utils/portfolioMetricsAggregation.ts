interface Survey {
  id: string;
  property_name: string;
  property_address: string;
  company_name: string | null;
  survey_date: string | null;
  issued: boolean;
  superseded_by_id: string | null;
  framework_type: 'fire_property' | 'fire_risk_assessment' | 'atex';
  form_data: any;
}

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

function round(value: number, decimals: number = 0): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

function getRiskBandLabel(score: number): string {
  if (score >= 85) return 'Very Good';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Tolerable';
  if (score >= 40) return 'Poor';
  return 'Very Poor';
}

function getRiskRating(score: number): 'Low' | 'Moderate' | 'High' {
  if (score >= 70) return 'Low';
  if (score >= 40) return 'Moderate';
  return 'High';
}

export function aggregatePortfolioMetrics(
  surveys: Survey[],
  activeFilters: ActiveFilters
): PortfolioMetrics | null {
  if (surveys.length < 2) {
    return null;
  }

  const issuedSurveys = surveys.filter(s => s.issued && !s.superseded_by_id);

  if (issuedSurveys.length === 0) {
    return null;
  }

  const metrics: PortfolioMetrics = {};

  const surveyDates = issuedSurveys
    .map(s => s.survey_date)
    .filter((date): date is string => date !== null)
    .sort();

  metrics.portfolioContext = {
    totalSurveys: issuedSurveys.length,
    filtersApplied: activeFilters,
  };

  if (surveyDates.length > 0) {
    metrics.portfolioContext.dateRange = {
      from: surveyDates[0],
      to: surveyDates[surveyDates.length - 1],
    };
  }

  const scoredSurveys = issuedSurveys.filter(
    s => s.form_data?.overallRiskScore !== undefined && s.form_data?.overallRiskScore > 0
  );

  if (scoredSurveys.length > 0) {
    const scores = scoredSurveys.map(s => s.form_data.overallRiskScore);
    const averageScore = round(
      scores.reduce((sum, score) => sum + score, 0) / scores.length
    );

    const distribution = {
      veryGood: 0,
      good: 0,
      tolerable: 0,
      poor: 0,
      veryPoor: 0,
    };

    scoredSurveys.forEach(s => {
      const score = s.form_data.overallRiskScore;
      const band = getRiskBandLabel(score);

      switch (band) {
        case 'Very Good':
          distribution.veryGood++;
          break;
        case 'Good':
          distribution.good++;
          break;
        case 'Tolerable':
          distribution.tolerable++;
          break;
        case 'Poor':
          distribution.poor++;
          break;
        case 'Very Poor':
          distribution.veryPoor++;
          break;
      }
    });

    metrics.riskProfile = {
      averageRiskScore: averageScore,
      overallRiskRating: getRiskRating(averageScore),
      riskScoreDistribution: distribution,
    };
  }

  const constructionTypes: Record<string, number> = {};
  const combustibilityData: number[] = [];

  issuedSurveys.forEach(survey => {
    if (survey.form_data?.buildings && Array.isArray(survey.form_data.buildings)) {
      survey.form_data.buildings.forEach((building: any) => {
        if (building.building_frame) {
          constructionTypes[building.building_frame] = (constructionTypes[building.building_frame] || 0) + 1;
        }
      });
    }

    if (survey.form_data?.siteCombustibilityPercentage !== undefined) {
      combustibilityData.push(survey.form_data.siteCombustibilityPercentage);
    }
  });

  if (Object.keys(constructionTypes).length > 0 || combustibilityData.length > 0) {
    metrics.constructionAndFireLoad = {
      dominantConstructionTypes: [],
      combustibilityStats: {
        averageCombustiblePercentage: 0,
        sitesAbove25Percent: 0,
        sitesAbove50Percent: 0,
      },
    };

    if (Object.keys(constructionTypes).length > 0) {
      const totalBuildings = Object.values(constructionTypes).reduce((sum, count) => sum + count, 0);

      metrics.constructionAndFireLoad.dominantConstructionTypes = Object.entries(constructionTypes)
        .map(([type, count]) => ({
          type,
          count,
          percentage: round((count / totalBuildings) * 100, 1),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    }

    if (combustibilityData.length > 0) {
      const avgCombustible = round(
        combustibilityData.reduce((sum, val) => sum + val, 0) / combustibilityData.length,
        1
      );

      metrics.constructionAndFireLoad.combustibilityStats = {
        averageCombustiblePercentage: avgCombustible,
        sitesAbove25Percent: combustibilityData.filter(val => val > 25).length,
        sitesAbove50Percent: combustibilityData.filter(val => val > 50).length,
      };
    }
  }

  const sprinklerCoverageData: number[] = [];
  const detectionCoverageData: number[] = [];

  issuedSurveys.forEach(survey => {
    if (survey.form_data?.buildings && Array.isArray(survey.form_data.buildings)) {
      survey.form_data.buildings.forEach((building: any) => {
        if (building.fire_protection?.sprinkler_coverage_pct !== undefined) {
          sprinklerCoverageData.push(building.fire_protection.sprinkler_coverage_pct);
        }
        if (building.fire_protection?.detection_coverage_pct !== undefined) {
          detectionCoverageData.push(building.fire_protection.detection_coverage_pct);
        }
      });
    }
  });

  if (sprinklerCoverageData.length > 0 || detectionCoverageData.length > 0) {
    metrics.protectionAndControls = {
      automaticFireProtection: {
        averageSprinklerCoverage: 0,
        sitesWithFullCoverage: 0,
        sitesWithPartialCoverage: 0,
        sitesWithNoCoverage: 0,
      },
      fireDetection: {
        averageDetectionCoverage: 0,
        sitesWithFullCoverage: 0,
        sitesWithPartialCoverage: 0,
        sitesWithNoCoverage: 0,
      },
    };

    if (sprinklerCoverageData.length > 0) {
      metrics.protectionAndControls.automaticFireProtection = {
        averageSprinklerCoverage: round(
          sprinklerCoverageData.reduce((sum, val) => sum + val, 0) / sprinklerCoverageData.length,
          1
        ),
        sitesWithFullCoverage: sprinklerCoverageData.filter(val => val >= 100).length,
        sitesWithPartialCoverage: sprinklerCoverageData.filter(val => val > 0 && val < 100).length,
        sitesWithNoCoverage: sprinklerCoverageData.filter(val => val === 0).length,
      };
    }

    if (detectionCoverageData.length > 0) {
      metrics.protectionAndControls.fireDetection = {
        averageDetectionCoverage: round(
          detectionCoverageData.reduce((sum, val) => sum + val, 0) / detectionCoverageData.length,
          1
        ),
        sitesWithFullCoverage: detectionCoverageData.filter(val => val >= 100).length,
        sitesWithPartialCoverage: detectionCoverageData.filter(val => val > 0 && val < 100).length,
        sitesWithNoCoverage: detectionCoverageData.filter(val => val === 0).length,
      };
    }
  }

  const allRecommendations: Array<{ category: string; priority: string }> = [];

  issuedSurveys.forEach(survey => {
    if (survey.form_data?.overallComments && Array.isArray(survey.form_data.overallComments)) {
      survey.form_data.overallComments.forEach((comment: any) => {
        if (comment.category && comment.priority) {
          allRecommendations.push({
            category: comment.category,
            priority: comment.priority,
          });
        }
      });
    }
  });

  if (allRecommendations.length > 0) {
    const categoryCounts: Record<string, number> = {};
    let highPriorityCount = 0;

    allRecommendations.forEach(rec => {
      categoryCounts[rec.category] = (categoryCounts[rec.category] || 0) + 1;

      if (rec.priority === 'High') {
        highPriorityCount++;
      }
    });

    const topCategories = Object.entries(categoryCounts)
      .map(([category, count]) => ({
        category,
        count,
        percentage: round((count / allRecommendations.length) * 100, 1),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    metrics.recommendationThemes = {
      totalRecommendations: allRecommendations.length,
      averageRecommendationsPerSite: round(allRecommendations.length / issuedSurveys.length, 1),
      topCategories,
      highPriorityCount,
    };
  }

  return metrics;
}
