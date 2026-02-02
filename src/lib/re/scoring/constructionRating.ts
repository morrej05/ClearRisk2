/**
 * Construction Rating Helper
 *
 * Computes a 1-5 construction rating for RE documents.
 * Prioritizes section_grades.construction if available, otherwise computes from RE-02 data.
 */

import { supabase } from '../../supabase';

export interface ConstructionRatingResult {
  rating: number;
  source: 'section_grade' | 'computed' | 'default';
  details?: string;
}

/**
 * Get construction rating for a document.
 * Priority:
 * 1. documents.section_grades.construction (if set)
 * 2. Compute from RE_02_CONSTRUCTION module data
 * 3. Default to 3 (Adequate)
 */
export async function getConstructionRating(documentId: string): Promise<ConstructionRatingResult> {
  try {
    // 1. Try to get from section_grades first
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('section_grades')
      .eq('id', documentId)
      .maybeSingle();

    if (!docError && doc?.section_grades?.construction) {
      return {
        rating: doc.section_grades.construction,
        source: 'section_grade',
        details: 'From documents.section_grades.construction',
      };
    }

    // 2. Try to compute from RE_02_CONSTRUCTION module
    const { data: re02, error: re02Error } = await supabase
      .from('module_instances')
      .select('data')
      .eq('document_id', documentId)
      .eq('module_key', 'RE_02_CONSTRUCTION')
      .maybeSingle();

    if (!re02Error && re02?.data) {
      const computed = computeConstructionRatingFromRE02(re02.data);
      return {
        rating: computed.rating,
        source: 'computed',
        details: computed.details,
      };
    }

    // 3. Default fallback
    return {
      rating: 3,
      source: 'default',
      details: 'No construction data available - defaulting to 3 (Adequate)',
    };
  } catch (error) {
    console.error('[getConstructionRating] Error:', error);
    return {
      rating: 3,
      source: 'default',
      details: 'Error fetching data - defaulting to 3',
    };
  }
}

/**
 * Compute construction rating from RE-02 module data.
 * Uses worst-case (minimum) rating across all buildings.
 *
 * Rating scale:
 * 5 = Excellent (Non-combustible, steel/concrete, well maintained)
 * 4 = Good (Mostly non-combustible, minor combustible elements)
 * 3 = Adequate (Mixed construction, some combustible content)
 * 2 = Poor (High combustible content, older construction)
 * 1 = Inadequate (Heavy combustible loading, significant fire spread risk)
 */
function computeConstructionRatingFromRE02(re02Data: any): { rating: number; details: string } {
  // Check if there's a direct site_rating_1_5 at the top level
  if (re02Data.ratings?.site_rating_1_5) {
    return {
      rating: re02Data.ratings.site_rating_1_5,
      details: 'From RE-02 site rating',
    };
  }

  // Try to compute from building data
  const buildings = re02Data.buildings || [];
  if (buildings.length === 0) {
    return {
      rating: 3,
      details: 'No buildings defined - default to 3',
    };
  }

  // Compute rating for each building and take worst case
  const buildingRatings = buildings.map((building: any) => {
    return computeBuildingConstructionRating(building);
  });

  const worstRating = Math.min(...buildingRatings);

  return {
    rating: worstRating,
    details: `Computed from ${buildings.length} building(s), worst case: ${worstRating}`,
  };
}

/**
 * Compute construction rating for a single building.
 * Simplified v1 heuristic based on key indicators.
 */
function computeBuildingConstructionRating(building: any): number {
  let rating = 3; // Start at adequate

  // Frame type influence (strong driver)
  const frame = building.frame_type?.toLowerCase() || '';
  if (frame.includes('steel') || frame.includes('concrete') || frame.includes('reinforced')) {
    rating += 1; // Better frame = higher rating
  } else if (frame.includes('timber') || frame.includes('wood')) {
    rating -= 2; // Combustible frame = much worse
  }

  // Roof/ceiling combustibility (major driver)
  const roofCombust = building.roof_ceiling_combustibility?.toLowerCase() || '';
  if (roofCombust.includes('non-combustible') || roofCombust.includes('concrete') || roofCombust.includes('metal')) {
    rating += 0.5;
  } else if (roofCombust.includes('combustible') || roofCombust.includes('timber') || roofCombust.includes('wood')) {
    rating -= 1.5;
  }

  // Wall combustibility
  const wallCombust = building.wall_combustibility?.toLowerCase() || '';
  if (wallCombust.includes('non-combustible') || wallCombust.includes('brick') || wallCombust.includes('concrete')) {
    rating += 0.5;
  } else if (wallCombust.includes('combustible') || wallCombust.includes('metal clad')) {
    rating -= 0.5;
  }

  // Weighted combustible percentage (if available)
  const weightedCombust = building.area_weighted_combustible_percent;
  if (weightedCombust !== undefined && weightedCombust !== null) {
    if (weightedCombust < 10) {
      rating += 1;
    } else if (weightedCombust < 25) {
      rating += 0.5;
    } else if (weightedCombust > 50) {
      rating -= 1;
    }
  }

  // Clamp to 1-5 range
  return Math.max(1, Math.min(5, Math.round(rating)));
}

/**
 * Sync helper: Set construction rating in section_grades.
 * Useful for ensuring section_grades stays in sync with RE-02 changes.
 */
export async function syncConstructionGrade(documentId: string): Promise<void> {
  const result = await getConstructionRating(documentId);

  if (result.source === 'section_grade') {
    // Already set in section_grades, no need to update
    return;
  }

  // Update section_grades with computed value
  const { data: doc, error: fetchError } = await supabase
    .from('documents')
    .select('section_grades')
    .eq('id', documentId)
    .maybeSingle();

  if (fetchError || !doc) {
    console.error('[syncConstructionGrade] Error fetching document:', fetchError);
    return;
  }

  const updatedGrades = {
    ...(doc.section_grades || {}),
    construction: result.rating,
  };

  const { error: updateError } = await supabase
    .from('documents')
    .update({ section_grades: updatedGrades })
    .eq('id', documentId);

  if (updateError) {
    console.error('[syncConstructionGrade] Error updating section_grades:', updateError);
  }
}
