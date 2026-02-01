interface RatingData {
  canonicalKey: string;
  label: string;
  rating: number;
  weight: number;
  score: number;
}

interface RecommendationData {
  text: string;
  priority: string;
}

interface GenerateReSummaryOptions {
  industryKey: string;
  siteName: string;
  assessmentDate: string;
  totalScore: number;
  topContributors: RatingData[];
  highPriorityRecommendations: RecommendationData[];
  recommendationCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export function generateRiskEngineeringSummary(options: GenerateReSummaryOptions): string {
  const {
    industryKey,
    siteName,
    assessmentDate,
    totalScore,
    topContributors,
    highPriorityRecommendations,
    recommendationCounts,
  } = options;

  const date = new Date(assessmentDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const totalRecs = recommendationCounts.critical + recommendationCounts.high +
                    recommendationCounts.medium + recommendationCounts.low;

  const paragraphs: string[] = [];

  paragraphs.push(
    `This Risk Engineering assessment was undertaken on ${date} for ${siteName}. ` +
    `The site has been evaluated against industry-specific risk criteria for the ${formatIndustryKey(industryKey)} sector, ` +
    `with a total risk score of ${totalScore.toFixed(1)}.`
  );

  if (topContributors.length > 0) {
    const topLabels = topContributors.map(tc => tc.label.toLowerCase());
    const topScores = topContributors.map(tc => tc.score.toFixed(1));

    let contributorText = 'The principal risk contributors identified are ';
    if (topContributors.length === 1) {
      contributorText += `${topLabels[0]} (${topScores[0]}).`;
    } else if (topContributors.length === 2) {
      contributorText += `${topLabels[0]} (${topScores[0]}) and ${topLabels[1]} (${topScores[1]}).`;
    } else {
      contributorText += `${topLabels[0]} (${topScores[0]}), ${topLabels[1]} (${topScores[1]}), and ${topLabels[2]} (${topScores[2]}).`;
    }

    paragraphs.push(contributorText);
  }

  if (totalRecs > 0) {
    const recParts: string[] = [];
    if (recommendationCounts.critical > 0) {
      recParts.push(`${recommendationCounts.critical} critical`);
    }
    if (recommendationCounts.high > 0) {
      recParts.push(`${recommendationCounts.high} high`);
    }
    if (recommendationCounts.medium > 0) {
      recParts.push(`${recommendationCounts.medium} medium`);
    }
    if (recommendationCounts.low > 0) {
      recParts.push(`${recommendationCounts.low} low`);
    }

    let recText = `The assessment has identified ${totalRecs} recommendation${totalRecs > 1 ? 's' : ''} (${recParts.join(', ')} priority).`;

    if (recommendationCounts.critical > 0 || recommendationCounts.high > 0) {
      recText += ' Immediate attention should be given to high and critical priority recommendations to reduce overall risk exposure.';
    } else if (recommendationCounts.medium > 0) {
      recText += ' Implementation of medium priority recommendations will further enhance risk management and operational resilience.';
    } else {
      recText += ' Addressing these lower priority recommendations will support continuous improvement in risk management practices.';
    }

    paragraphs.push(recText);
  } else {
    paragraphs.push(
      'No specific recommendations have been raised at this time. ' +
      'Continued monitoring and maintenance of existing risk controls is advised to ensure sustained protection of property and business continuity.'
    );
  }

  paragraphs.push(
    'Full details of the assessment methodology, individual risk factor evaluations, and detailed recommendations are provided in the main body of this report.'
  );

  return paragraphs.join(' ');
}

function formatIndustryKey(key: string): string {
  const industryMap: Record<string, string> = {
    'light_manufacturing': 'light manufacturing',
    'heavy_manufacturing': 'heavy manufacturing',
    'warehouse_distribution': 'warehouse and distribution',
    'office_commercial': 'office and commercial',
    'retail': 'retail',
    'hospitality': 'hospitality',
    'healthcare': 'healthcare',
    'education': 'education',
    'food_processing': 'food processing',
    'chemical_pharmaceutical': 'chemical and pharmaceutical',
    'data_centre': 'data centre',
    'entertainment': 'entertainment',
  };

  return industryMap[key] || key.replace(/_/g, ' ');
}
