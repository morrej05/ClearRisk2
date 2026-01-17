import { supabase } from '../lib/supabase';
import legacyMap from '../data/legacyRecommendationMap.json';

interface LegacyRecommendationMapping {
  field_key: string;
  section_key: string;
  trigger_values: string[];
  category: string;
  hazard: string;
  observation: string;
  action_text: string;
  priority: number;
}

interface TriggerContext {
  section_key: string;
  field_key: string;
  rating_value: string;
  building_id?: string;
  building_name?: string;
}

const mappings = legacyMap as LegacyRecommendationMapping[];

export async function handleLegacyTrigger(
  surveyId: string,
  fieldKey: string,
  newValue: string,
  oldValue: string,
  buildingId?: string,
  buildingName?: string
): Promise<void> {
  const mapping = mappings.find(m => m.field_key === fieldKey);

  if (!mapping) {
    return;
  }

  const wasTriggered = mapping.trigger_values.includes(oldValue);
  const isTriggered = mapping.trigger_values.includes(newValue);

  const triggerContext: TriggerContext = {
    section_key: mapping.section_key,
    field_key: fieldKey,
    rating_value: newValue,
    ...(buildingId && { building_id: buildingId }),
    ...(buildingName && { building_name: buildingName })
  };

  const triggerKey = buildingId
    ? `${surveyId}:${mapping.section_key}:${fieldKey}:${buildingId}`
    : `${surveyId}:${mapping.section_key}:${fieldKey}`;

  if (isTriggered && !wasTriggered) {
    await upsertTriggeredRecommendation(surveyId, triggerKey, mapping, triggerContext);
  } else if (!isTriggered && wasTriggered) {
    await deactivateTriggeredRecommendation(surveyId, triggerKey);
  }
}

async function upsertTriggeredRecommendation(
  surveyId: string,
  triggerKey: string,
  mapping: LegacyRecommendationMapping,
  context: TriggerContext
): Promise<void> {
  try {
    const { data: existingRecs } = await supabase
      .from('survey_recommendations')
      .select('sort_index')
      .eq('survey_id', surveyId)
      .order('sort_index', { ascending: false })
      .limit(1);

    const maxSortIndex = existingRecs && existingRecs.length > 0
      ? existingRecs[0].sort_index
      : -1;

    let observation = mapping.observation;
    let action = mapping.action_text;

    if (context.building_name) {
      observation = `${context.building_name}: ${observation}`;
      action = `${context.building_name}: ${action}`;
    }

    const { data: existing } = await supabase
      .from('survey_recommendations')
      .select('id')
      .eq('survey_id', surveyId)
      .eq('trigger_key', triggerKey)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('survey_recommendations')
        .update({
          hazard: mapping.hazard,
          description_final: observation,
          action_final: action,
          category: mapping.category,
          priority: mapping.priority,
          status: 'open',
          include_in_report: true,
          trigger_context: context,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('survey_recommendations')
        .insert([{
          survey_id: surveyId,
          trigger_key: triggerKey,
          hazard: mapping.hazard,
          description_final: observation,
          action_final: action,
          client_response: null,
          category: mapping.category,
          priority: mapping.priority,
          status: 'open',
          source: 'triggered',
          sort_index: maxSortIndex + 1,
          include_in_report: true,
          trigger_context: context
        }]);
    }
  } catch (err) {
    console.error('Error upserting triggered recommendation:', err);
  }
}

async function deactivateTriggeredRecommendation(
  surveyId: string,
  triggerKey: string
): Promise<void> {
  try {
    await supabase
      .from('survey_recommendations')
      .update({
        include_in_report: false,
        status: 'deferred',
        updated_at: new Date().toISOString()
      })
      .eq('survey_id', surveyId)
      .eq('trigger_key', triggerKey);
  } catch (err) {
    console.error('Error deactivating triggered recommendation:', err);
  }
}

export function shouldTriggerRecommendation(
  fieldKey: string,
  oldValue: string,
  newValue: string
): boolean {
  const mapping = mappings.find(m => m.field_key === fieldKey);

  if (!mapping) {
    return false;
  }

  const wasTriggered = mapping.trigger_values.includes(oldValue);
  const isTriggered = mapping.trigger_values.includes(newValue);

  return isTriggered !== wasTriggered;
}
