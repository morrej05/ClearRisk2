import { supabase } from '../../supabase';

interface RecommendationFromRatingParams {
  documentId: string;
  sourceModuleKey: string;
  sourceFactorKey?: string;
  rating_1_5: number;
  industryKey: string | null;
}

interface RatingAutoTemplate {
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
 * Generate TWO auto-recommendation templates for a given factor and rating
 * Returns [Action-focused rec, Assurance-focused rec]
 */
function generateDualRatingTemplates(
  canonicalKey: string,
  rating_1_5: number
): [RatingAutoTemplate, RatingAutoTemplate] {
  const factorLabel = humanizeFactorKey(canonicalKey);
  const isCritical = rating_1_5 === 1;
  const severity = isCritical ? 'critical' : 'below standard';
  const severityCapital = isCritical ? 'Critical' : 'Below Standard';

  // Generic hazard text based on severity
  const hazardTextCritical = `Current conditions indicate a critical control gap. A fire or equipment failure may escalate rapidly, increasing the likelihood of major loss and prolonged shutdown. Immediate corrective action is required to reduce exposure.`;

  const hazardTextBelowStandard = `Controls are below standard. A foreseeable event could develop faster than planned defenses, increasing damage extent and recovery time. Improvements should be implemented to strengthen resilience.`;

  const hazardText = isCritical ? hazardTextCritical : hazardTextBelowStandard;

  // Template A: Action-focused (direct improvement)
  const templateA: RatingAutoTemplate = {
    title: `Improve ${factorLabel}`,
    observation_text: `${factorLabel} is currently rated as ${severityCapital} (rating ${rating_1_5}/5). This indicates a ${severity} control gap that requires attention.`,
    action_required_text: `Review and implement improvements to bring ${factorLabel} up to acceptable standards. Address identified deficiencies through documented corrective actions.`,
    hazard_text: hazardText,
  };

  // Template B: Assurance-focused (verification/monitoring)
  const templateB: RatingAutoTemplate = {
    title: `Strengthen assurance for ${factorLabel}`,
    observation_text: `The rating of ${rating_1_5}/5 for ${factorLabel} reflects insufficient verification or monitoring of control effectiveness.`,
    action_required_text: `Establish ongoing assurance mechanisms for ${factorLabel}. Implement regular reviews, testing schedules, or monitoring protocols to maintain control integrity.`,
    hazard_text: hazardText,
  };

  return [templateA, templateB];
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
 * Ensures TWO auto recommendations are created in re_recommendations table based on a rating.
 * Creates one action-focused and one assurance-focused recommendation.
 *
 * @param params - Parameters for creating/ensuring the recommendation
 * @returns The created or existing recommendation ID, or null if no recommendation needed
 */
export async function ensureRecommendationFromRating(
  params: RecommendationFromRatingParams
): Promise<string | null> {
  const { documentId, sourceModuleKey, sourceFactorKey, rating_1_5, industryKey } = params;
  void industryKey; // Not used in current implementation

  // Only create recommendations for ratings <= 2
  if (rating_1_5 > 2) {
    // Leave existing recommendations as-is (engineer may have customized them)
    return null;
  }

  const priority = rating_1_5 === 1 ? 'High' : 'Medium';
  const baseFactorKey = sourceFactorKey || sourceModuleKey;

  // Generate two templates: Action-focused and Assurance-focused
  const [templateA, templateB] = generateDualRatingTemplates(baseFactorKey, rating_1_5);

  // Create/ensure both recommendations with suffixed factor keys
  const suffixes = ['__A', '__B'] as const;
  const templates = [templateA, templateB];

  let lastCreatedId: string | null = null;

  for (let i = 0; i < 2; i++) {
    const suffix = suffixes[i];
    const template = templates[i];
    const suffixedFactorKey = `${baseFactorKey}${suffix}`;

    // Check if this specific suffixed recommendation already exists
    const { data: existing } = await supabase
      .from('re_recommendations')
      .select('id')
      .eq('document_id', documentId)
      .eq('source_type', 'auto')
      .eq('source_module_key', sourceModuleKey)
      .eq('source_factor_key', suffixedFactorKey)
      .maybeSingle();

    if (existing) {
      // Already exists, skip creation (idempotent)
      lastCreatedId = existing.id;
      continue;
    }

    // Create new auto recommendation
    const { data: created, error } = await supabase
      .from('re_recommendations')
      .insert({
        document_id: documentId,
        source_type: 'auto',
        library_id: null,
        source_module_key: sourceModuleKey,
        source_factor_key: suffixedFactorKey,
        title: template.title,
        observation_text: template.observation_text,
        action_required_text: template.action_required_text,
        hazard_text: template.hazard_text,
        priority: priority,
        status: 'Open',
        photos: [],
      })
      .select('id')
      .single();

    if (error) {
      console.error(`Error creating auto recommendation ${suffix}:`, error);
      continue;
    }

    lastCreatedId = created.id;
  }

  return lastCreatedId;
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

  const priority = rating_1_5 === 1 ? 'High' : rating_1_5 === 2 ? 'Medium' : 'Low';

  const { data, error } = await supabase
    .from('re_recommendations')
    .insert({
      document_id: documentId,
      source_type: 'auto',
      library_id: libraryTemplate.id,
      source_module_key: sourceModuleKey,
      source_factor_key: sourceFactorKey || null,
      title: libraryTemplate.title,
      observation_text: libraryTemplate.observation_text,
      action_required_text: libraryTemplate.action_required_text,
      hazard_text: libraryTemplate.hazard_text,
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
  const factorLabel = sourceFactorKey
    ? sourceFactorKey.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : 'Factor';

  const severity = rating_1_5 === 1 ? 'Critical' : 'Below Standard';

  const { data, error } = await supabase
    .from('re_recommendations')
    .insert({
      document_id: documentId,
      source_type: 'auto',
      source_module_key: sourceModuleKey,
      source_factor_key: sourceFactorKey || null,
      title: `${factorLabel} Improvement Required`,
      observation_text: `${factorLabel} is currently rated as ${severity} (rating ${rating_1_5}/5).`,
      action_required_text: `Review and implement improvements to bring ${factorLabel} up to acceptable standards.`,
      hazard_text: `Inadequate ${factorLabel} increases facility risk profile.`,
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
  void moduleKey;

  await ensureRecommendationFromRating({
    documentId,
    sourceModuleKey: canonicalKey,
    rating_1_5,
    industryKey,
  });
}
