/**
 * Auto-generation logic for RE recommendations
 *
 * Deterministically generates recommendations from the recommendation library
 * based on section grades/ratings. No AI involved - pure rule-based generation.
 *
 * Trigger Rules:
 * - Rating 1: ALWAYS generate (critical deficiency)
 * - Rating 2: Generate by default (significant gap)
 * - Rating >= 3: Do not generate
 *
 * If an auto recommendation already exists for a given library item + document,
 * do not duplicate. If user has suppressed it (deleted it), respect that.
 */

import { supabase } from '../lib/supabase';

interface SectionGrade {
  section_key: string;
  grade: number;
  factor_key?: string;
}

interface RecommendationLibraryItem {
  id: string;
  source_module_key: string;
  source_factor_key?: string;
  trigger_rating_threshold: number;
  default_title: string;
  default_observation: string;
  default_action: string;
  default_hazard: string;
  default_priority: string;
  is_active: boolean;
}

interface ExistingRecommendation {
  id: string;
  library_id?: string;
  is_suppressed: boolean;
}

/**
 * Generate recommendations based on section grades
 * @param documentId - The document to generate recommendations for
 * @param sectionGrades - Array of section grades (from document.section_grades)
 * @returns Array of created recommendation IDs
 */
export async function generateRecommendationsFromRatings(
  documentId: string,
  sectionGrades: SectionGrade[]
): Promise<string[]> {
  try {
    // 1. Fetch all active library items
    const { data: libraryItems, error: libraryError } = await supabase
      .from('re_recommendation_library')
      .select('*')
      .eq('is_active', true);

    if (libraryError) throw libraryError;
    if (!libraryItems || libraryItems.length === 0) {
      console.log('No active recommendation library items found');
      return [];
    }

    // 2. Fetch existing recommendations for this document
    const { data: existingRecs, error: existingError } = await supabase
      .from('re_recommendations')
      .select('id, library_id, is_suppressed')
      .eq('document_id', documentId)
      .eq('source_type', 'auto');

    if (existingError) throw existingError;

    const existingLibraryIds = new Set(
      (existingRecs || [])
        .filter((r) => r.library_id && !r.is_suppressed)
        .map((r) => r.library_id)
    );

    const suppressedLibraryIds = new Set(
      (existingRecs || [])
        .filter((r) => r.library_id && r.is_suppressed)
        .map((r) => r.library_id)
    );

    // 3. Build a map of section_key -> grade
    const gradeMap = new Map<string, number>();
    sectionGrades.forEach((sg) => {
      // Store by module key
      gradeMap.set(sg.section_key, sg.grade);
      // Also store by module + factor if factor exists
      if (sg.factor_key) {
        gradeMap.set(`${sg.section_key}:${sg.factor_key}`, sg.grade);
      }
    });

    // 4. Determine which library items should trigger
    const recommendationsToCreate: any[] = [];

    for (const item of libraryItems as RecommendationLibraryItem[]) {
      // Skip if already exists and not suppressed
      if (existingLibraryIds.has(item.id)) {
        continue;
      }

      // Skip if user has suppressed this recommendation
      if (suppressedLibraryIds.has(item.id)) {
        continue;
      }

      // Check if rating triggers this recommendation
      let shouldTrigger = false;
      let matchedGrade: number | undefined;

      // Try exact match with factor key
      if (item.source_factor_key) {
        const factorKey = `${item.source_module_key}:${item.source_factor_key}`;
        matchedGrade = gradeMap.get(factorKey);
      }

      // Fall back to module-level grade
      if (matchedGrade === undefined) {
        matchedGrade = gradeMap.get(item.source_module_key);
      }

      // Check if grade meets threshold
      if (matchedGrade !== undefined && matchedGrade <= item.trigger_rating_threshold) {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();

        recommendationsToCreate.push({
          id: crypto.randomUUID(),
          document_id: documentId,
          source_type: 'auto',
          library_id: item.id,
          source_module_key: item.source_module_key,
          source_factor_key: item.source_factor_key || null,
          title: item.default_title,
          observation_text: item.default_observation,
          action_required_text: item.default_action,
          hazard_text: item.default_hazard,
          comments_text: `Auto-generated based on rating of ${matchedGrade}`,
          status: 'Open',
          priority: item.default_priority,
          target_date: null,
          owner: null,
          photos: [],
          is_suppressed: false,
          created_by: user?.id,
        });
      }
    }

    // 5. Insert new recommendations
    if (recommendationsToCreate.length > 0) {
      const { data: createdRecs, error: insertError } = await supabase
        .from('re_recommendations')
        .insert(recommendationsToCreate)
        .select('id');

      if (insertError) throw insertError;

      console.log(`Generated ${recommendationsToCreate.length} new recommendations`);
      return (createdRecs || []).map((r) => r.id);
    }

    return [];
  } catch (error) {
    console.error('Error generating recommendations:', error);
    throw error;
  }
}

/**
 * Re-evaluate and regenerate recommendations after ratings change
 * This will:
 * 1. Check all library items against current ratings
 * 2. Create missing recommendations that should exist
 * 3. Respect suppressed recommendations (user-deleted autos)
 *
 * @param documentId - The document to regenerate recommendations for
 * @param sectionGrades - Updated section grades
 */
export async function regenerateRecommendations(
  documentId: string,
  sectionGrades: SectionGrade[]
): Promise<{ created: number; skipped: number }> {
  const createdIds = await generateRecommendationsFromRatings(documentId, sectionGrades);

  // Count how many were skipped (already exist or suppressed)
  const { data: libraryItems } = await supabase
    .from('re_recommendation_library')
    .select('id')
    .eq('is_active', true);

  const totalPossible = libraryItems?.length || 0;
  const skipped = totalPossible - createdIds.length;

  return {
    created: createdIds.length,
    skipped,
  };
}

/**
 * Get count of recommendations that could be auto-generated
 * based on current ratings (informational only)
 */
export async function getAutoGeneratableCount(
  documentId: string,
  sectionGrades: SectionGrade[]
): Promise<number> {
  try {
    const { data: libraryItems } = await supabase
      .from('re_recommendation_library')
      .select('*')
      .eq('is_active', true);

    if (!libraryItems) return 0;

    const { data: existingRecs } = await supabase
      .from('re_recommendations')
      .select('library_id, is_suppressed')
      .eq('document_id', documentId)
      .eq('source_type', 'auto');

    const existingLibraryIds = new Set(
      (existingRecs || [])
        .filter((r) => r.library_id && !r.is_suppressed)
        .map((r) => r.library_id)
    );

    const suppressedLibraryIds = new Set(
      (existingRecs || [])
        .filter((r) => r.library_id && r.is_suppressed)
        .map((r) => r.library_id)
    );

    const gradeMap = new Map<string, number>();
    sectionGrades.forEach((sg) => {
      gradeMap.set(sg.section_key, sg.grade);
      if (sg.factor_key) {
        gradeMap.set(`${sg.section_key}:${sg.factor_key}`, sg.grade);
      }
    });

    let count = 0;
    for (const item of libraryItems as RecommendationLibraryItem[]) {
      if (existingLibraryIds.has(item.id) || suppressedLibraryIds.has(item.id)) {
        continue;
      }

      let matchedGrade: number | undefined;
      if (item.source_factor_key) {
        matchedGrade = gradeMap.get(`${item.source_module_key}:${item.source_factor_key}`);
      }
      if (matchedGrade === undefined) {
        matchedGrade = gradeMap.get(item.source_module_key);
      }

      if (matchedGrade !== undefined && matchedGrade <= item.trigger_rating_threshold) {
        count++;
      }
    }

    return count;
  } catch (error) {
    console.error('Error calculating auto-generable count:', error);
    return 0;
  }
}
