import { supabase } from '../../supabase';

interface RecommendationFromRatingParams {
  documentId: string;
  sourceModuleKey: string;
  sourceFactorKey?: string;
  rating_1_5: number;
  industryKey: string | null;
}

interface FallbackContent {
  title: string;
  observation_text: string;
  action_required_text: string;
  hazard_text: string;
}

/**
 * Humanize a canonical key into a readable phrase
 */
function humanizeFactorKey(canonicalKey: string): string {
  return canonicalKey
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Build fallback content for auto-recommendations when library doesn't provide it.
 * Uses SAME wording for rating 1 and 2 (only priority differs).
 */
function buildFallbackContent(factorKey: string): FallbackContent {
  const factorLabel = humanizeFactorKey(factorKey);

  return {
    title: `Improve ${factorLabel}`,
    observation_text: `${factorLabel} has been identified as requiring attention based on current site conditions. Control effectiveness is below acceptable standards and requires corrective action.`,
    action_required_text: `Review and implement improvements to bring ${factorLabel} up to acceptable standards. Address identified deficiencies through documented corrective actions with clear ownership and target dates.`,
    hazard_text: `Inadequate controls increase the likelihood of loss events escalating beyond planned defenses. A foreseeable incident could develop faster than current safeguards allow, increasing damage extent and recovery time. Strengthening this control reduces overall facility risk profile.`,
  };
}

interface LibraryRecommendation {
  id: string;
  title: string;
  observation_text: string;
  action_required_text: string;
  hazard_text: string;
  priority: 'High' | 'Medium' | 'Low';
  relevance_rules?: {
    modules?: string[];
    factors?: string[];
    industries?: string[];
    min_rating?: number;
    max_rating?: number;
  };
}

/**
 * Ensures ONE auto recommendation is created in re_recommendations table based on a rating.
 * Uses same wording for rating 1 and 2 (only priority differs).
 *
 * @param params - Parameters for creating/ensuring the recommendation
 * @returns The created or existing recommendation ID, or null if no recommendation needed
 */
export async function ensureRecommendationFromRating(
  params: RecommendationFromRatingParams
): Promise<string | null> {
  const { documentId, sourceModuleKey, sourceFactorKey, rating_1_5, industryKey } = params;

  // Only create recommendations for ratings <= 2
  if (rating_1_5 > 2) {
    // Leave existing recommendations as-is (engineer may have customized them)
    return null;
  }

  const priority = rating_1_5 === 1 ? 'High' : 'Medium';

  // Check if auto recommendation already exists for this factor (idempotent)
  const { data: existing } = await supabase
    .from('re_recommendations')
    .select('id')
    .eq('document_id', documentId)
    .eq('source_type', 'auto')
    .eq('source_module_key', sourceModuleKey)
    .eq('source_factor_key', sourceFactorKey || null)
    .eq('is_suppressed', false)
    .maybeSingle();

  if (existing) {
    // Already exists, return its ID (idempotent)
    return existing.id;
  }

  // Try to find matching library recommendation
  const libraryTemplate = await findMatchingLibraryRecommendation({
    sourceModuleKey,
    sourceFactorKey,
    rating_1_5,
    industryKey,
  });

  if (libraryTemplate) {
    // Create from library template (with fallback hazard if needed)
    return await createRecommendationFromLibrary({
      documentId,
      sourceModuleKey,
      sourceFactorKey,
      rating_1_5,
      libraryTemplate,
    });
  }

  // No library template, create with fallback content
  return await createBasicRecommendation({
    documentId,
    sourceModuleKey,
    sourceFactorKey,
    rating_1_5,
  });
}

/**
 * Find a matching recommendation template from the library
 */
async function findMatchingLibraryRecommendation(params: {
  sourceModuleKey: string;
  sourceFactorKey?: string;
  rating_1_5: number;
  industryKey: string | null;
}): Promise<LibraryRecommendation | null> {
  const { sourceModuleKey, sourceFactorKey, rating_1_5, industryKey } = params;

  try {
    // Query library recommendations with relevance to this module/factor
    const { data: templates, error } = await supabase
      .from('re_recommendation_library')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (error) {
      console.error('Error querying recommendation library:', error);
      return null;
    }

    if (!templates || templates.length === 0) {
      return null;
    }

    // Find best matching template based on relevance rules
    const matchingTemplate = templates.find((template: any) => {
      const rules = template.relevance_rules || {};

      // Check module match
      if (rules.modules && Array.isArray(rules.modules)) {
        if (!rules.modules.includes(sourceModuleKey)) {
          return false;
        }
      }

      // Check factor match
      if (sourceFactorKey && rules.factors && Array.isArray(rules.factors)) {
        if (!rules.factors.includes(sourceFactorKey)) {
          return false;
        }
      }

      // Check rating range
      if (rules.min_rating && rating_1_5 < rules.min_rating) {
        return false;
      }
      if (rules.max_rating && rating_1_5 > rules.max_rating) {
        return false;
      }

      // Check industry match (if specified)
      if (industryKey && rules.industries && Array.isArray(rules.industries)) {
        if (!rules.industries.includes(industryKey)) {
          return false;
        }
      }

      return true;
    });

    return matchingTemplate || null;
  } catch (err) {
    console.error('Error finding library recommendation:', err);
    return null;
  }
}

/**
 * Create a recommendation from a library template
 */
async function createRecommendationFromLibrary(params: {
  documentId: string;
  sourceModuleKey: string;
  sourceFactorKey?: string;
  rating_1_5: number;
  libraryTemplate: LibraryRecommendation;
}): Promise<string | null> {
  const { documentId, sourceModuleKey, sourceFactorKey, rating_1_5, libraryTemplate } = params;

  const priority = rating_1_5 === 1 ? 'High' : 'Medium';
  const fallback = buildFallbackContent(sourceFactorKey || sourceModuleKey);

  // Use library content, but fallback for any blank fields
  const { data, error } = await supabase
    .from('re_recommendations')
    .insert({
      document_id: documentId,
      source_type: 'auto',
      library_id: libraryTemplate.id,
      source_module_key: sourceModuleKey,
      source_factor_key: sourceFactorKey || null,
      title: libraryTemplate.title || fallback.title,
      observation_text: libraryTemplate.observation_text || fallback.observation_text,
      action_required_text: libraryTemplate.action_required_text || fallback.action_required_text,
      hazard_text: libraryTemplate.hazard_text || fallback.hazard_text,
      priority: priority,
      status: 'Open',
      photos: [],
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating recommendation from library:', error);
    return null;
  }

  return data.id;
}

/**
 * Create a basic recommendation when no library template exists
 */
async function createBasicRecommendation(params: {
  documentId: string;
  sourceModuleKey: string;
  sourceFactorKey?: string;
  rating_1_5: number;
}): Promise<string | null> {
  const { documentId, sourceModuleKey, sourceFactorKey, rating_1_5 } = params;

  const priority = rating_1_5 === 1 ? 'High' : 'Medium';
  const content = buildFallbackContent(sourceFactorKey || sourceModuleKey);

  const { data, error } = await supabase
    .from('re_recommendations')
    .insert({
      document_id: documentId,
      source_type: 'auto',
      library_id: null,
      source_module_key: sourceModuleKey,
      source_factor_key: sourceFactorKey || null,
      title: content.title,
      observation_text: content.observation_text,
      action_required_text: content.action_required_text,
      hazard_text: content.hazard_text,
      priority: priority,
      status: 'Open',
      photos: [],
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating basic recommendation:', error);
    return null;
  }

  return data.id;
}

/**
 * Check if an auto recommendation exists for a given factor
 */
export async function hasAutoRecommendation(
  documentId: string,
  sourceModuleKey: string,
  sourceFactorKey?: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('re_recommendations')
    .select('id')
    .eq('document_id', documentId)
    .eq('source_type', 'auto')
    .eq('source_module_key', sourceModuleKey)
    .eq('source_factor_key', sourceFactorKey || null)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Error checking auto recommendation:', error);
    return false;
  }

  return !!data;
}


export async function syncAutoRecToRegister(params: {
  documentId: string;
  moduleKey: string;
  canonicalKey: string;
  rating_1_5: number;
  industryKey: string | null;
}): Promise<void> {
  const { documentId, moduleKey, canonicalKey, rating_1_5, industryKey } = params;

  await ensureRecommendationFromRating({
    documentId,
    sourceModuleKey: moduleKey,          // ✅ correct
    sourceFactorKey: canonicalKey,       // ✅ correct
    rating_1_5,
    industryKey,
  });
}

