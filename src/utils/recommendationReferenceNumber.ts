export interface RecommendationWithRef {
  id: string;
  ref_number?: string;
  [key: string]: any;
}

export function generateReferenceNumber(surveyYear: number, sequenceNumber: number): string {
  const yearSuffix = String(surveyYear).slice(-2);
  const sequence = String(sequenceNumber).padStart(2, '0');
  return `${yearSuffix}-${sequence}`;
}

export function getSurveyYear(surveyDate?: string, issueDate?: string): number {
  const dateToUse = surveyDate || issueDate || new Date().toISOString();
  return new Date(dateToUse).getFullYear();
}

export function ensureReferenceNumbers(
  recommendations: RecommendationWithRef[],
  surveyYear: number
): RecommendationWithRef[] {
  let sequenceCounter = 1;

  return recommendations.map((rec) => {
    if (!rec.ref_number) {
      const newRefNumber = generateReferenceNumber(surveyYear, sequenceCounter);
      sequenceCounter++;
      return {
        ...rec,
        ref_number: newRefNumber,
      };
    }
    return rec;
  });
}

export function sortByReferenceNumber(
  recommendations: RecommendationWithRef[]
): RecommendationWithRef[] {
  return [...recommendations].sort((a, b) => {
    if (!a.ref_number) return 1;
    if (!b.ref_number) return -1;

    const parseRef = (ref: string): [number, number] => {
      const parts = ref.split('-');
      return [parseInt(parts[0] || '0'), parseInt(parts[1] || '0')];
    };

    const [aYear, aSeq] = parseRef(a.ref_number);
    const [bYear, bSeq] = parseRef(b.ref_number);

    if (aYear !== bYear) return aYear - bYear;
    return aSeq - bSeq;
  });
}
