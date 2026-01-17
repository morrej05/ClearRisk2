import { supabase } from '../lib/supabase';

interface TriggerContext {
  section_key: string;
  field_key: string;
  rating_value: string;
  field_label?: string;
}

interface RecommendationTrigger {
  id: string;
  section_key: string;
  field_key: string;
  rating_value: string;
  template_id: string;
  priority: number;
  is_active: boolean;
  recommendation_templates: {
    hazard: string;
    description: string;
    action: string;
    client_response_prompt: string | null;
    category: string;
    default_priority: number;
  };
}

/**
 * Evaluates triggers for a specific field rating and upserts recommendations
 * @param surveyId - The survey to add recommendations to
 * @param sectionKey - The section identifier (e.g., "fire_safety")
 * @param fieldKey - The field identifier (e.g., "fire_detection")
 * @param ratingValue - The rating value (e.g., "Poor", "Inadequate")
 * @param fieldLabel - Optional human-readable field name for context
 */
export async function evaluateTriggers(
  surveyId: string,
  sectionKey: string,
  fieldKey: string,
  ratingValue: string,
  fieldLabel?: string
): Promise<{ success: boolean; recommendationsAdded: number; error?: string }> {
  let matchedCount = 0;
  let addedCount = 0;
  let errorMsg: string | undefined;

  try {
    // Normalize rating value to lowercase for matching
    const normalizedRating = ratingValue.toLowerCase().trim();

    // Look up triggers matching this field and rating
    const { data: triggers, error: triggerError } = await supabase
      .from('recommendation_triggers')
      .select(`
        *,
        recommendation_templates:template_id (
          hazard,
          description,
          action,
          client_response_prompt,
          category,
          default_priority
        )
      `)
      .eq('section_key', sectionKey)
      .eq('field_key', fieldKey)
      .ilike('rating_value', normalizedRating)
      .eq('is_active', true);

    if (triggerError) {
      console.error('Error fetching triggers:', triggerError);
      errorMsg = triggerError.message;

      // Log evaluation attempt
      await supabase.from('trigger_evaluation_log').insert({
        survey_id: surveyId,
        section_key: sectionKey,
        field_key: fieldKey,
        rating_value: ratingValue,
        matched_trigger_count: 0,
        recommendations_added: 0,
        error_message: triggerError.message,
        evaluation_context: { normalized_rating: normalizedRating, field_label: fieldLabel }
      });

      return { success: false, recommendationsAdded: 0, error: triggerError.message };
    }

    matchedCount = triggers?.length || 0;

    if (!triggers || triggers.length === 0) {
      // Log evaluation attempt with no matches
      await supabase.from('trigger_evaluation_log').insert({
        survey_id: surveyId,
        section_key: sectionKey,
        field_key: fieldKey,
        rating_value: ratingValue,
        matched_trigger_count: 0,
        recommendations_added: 0,
        evaluation_context: { normalized_rating: normalizedRating, field_label: fieldLabel }
      });

      return { success: true, recommendationsAdded: 0 };
    }

    // Process each trigger
    for (const trigger of triggers as RecommendationTrigger[]) {
      const template = trigger.recommendation_templates;
      if (!template) continue;

      // Generate unique trigger key for idempotent upserts
      const triggerKey = `${sectionKey}:${fieldKey}:${ratingValue}:${trigger.template_id}`;

      const triggerContext: TriggerContext = {
        section_key: sectionKey,
        field_key: fieldKey,
        rating_value: ratingValue,
        field_label: fieldLabel
      };

      // Upsert recommendation (will update if trigger_key already exists)
      const { error: upsertError } = await supabase
        .from('survey_recommendations')
        .upsert(
          {
            survey_id: surveyId,
            trigger_key: triggerKey,
            template_id: trigger.template_id,
            hazard: template.hazard,
            description_final: template.description,
            action_final: template.action,
            client_response: template.client_response_prompt || '',
            category: template.category,
            priority: trigger.priority,
            status: 'open',
            source: 'triggered',
            include_in_report: true,
            trigger_context: triggerContext,
            sort_index: 0
          },
          {
            onConflict: 'survey_id,trigger_key',
            ignoreDuplicates: false
          }
        );

      if (upsertError) {
        console.error('Error upserting recommendation:', upsertError);
        continue;
      }

      addedCount++;
    }

    // Log successful evaluation
    await supabase.from('trigger_evaluation_log').insert({
      survey_id: surveyId,
      section_key: sectionKey,
      field_key: fieldKey,
      rating_value: ratingValue,
      matched_trigger_count: matchedCount,
      recommendations_added: addedCount,
      evaluation_context: {
        normalized_rating: normalizedRating,
        field_label: fieldLabel,
        trigger_ids: triggers.map(t => t.id)
      }
    });

    return { success: true, recommendationsAdded: addedCount };
  } catch (err: any) {
    console.error('Error evaluating triggers:', err);
    errorMsg = err.message;

    // Log failed evaluation
    await supabase.from('trigger_evaluation_log').insert({
      survey_id: surveyId,
      section_key: sectionKey,
      field_key: fieldKey,
      rating_value: ratingValue,
      matched_trigger_count: matchedCount,
      recommendations_added: addedCount,
      error_message: err.message,
      evaluation_context: { field_label: fieldLabel }
    });

    return { success: false, recommendationsAdded: 0, error: err.message };
  }
}

/**
 * Removes (soft deletes) triggered recommendations when a field rating improves
 * @param surveyId - The survey ID
 * @param sectionKey - The section identifier
 * @param fieldKey - The field identifier
 * @param oldRatingValue - The previous rating value
 */
export async function removeTriggers(
  surveyId: string,
  sectionKey: string,
  fieldKey: string,
  oldRatingValue: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Find all recommendations with this trigger pattern
    const triggerKeyPattern = `${sectionKey}:${fieldKey}:${oldRatingValue}:%`;

    // Soft delete by setting include_in_report=false and status=deferred
    const { error } = await supabase
      .from('survey_recommendations')
      .update({
        include_in_report: false,
        status: 'deferred'
      })
      .eq('survey_id', surveyId)
      .like('trigger_key', triggerKeyPattern);

    if (error) {
      console.error('Error removing triggers:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error in removeTriggers:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Re-evaluates all triggers for a survey based on current field values
 * Useful after bulk updates or imports
 * @param surveyId - The survey ID
 * @param surveyData - The survey data object with all sections and fields
 */
export async function reevaluateAllTriggers(
  surveyId: string,
  surveyData: any
): Promise<{ success: boolean; totalAdded: number; error?: string }> {
  let totalAdded = 0;

  try {
    // Iterate through all sections and fields
    for (const [sectionKey, sectionData] of Object.entries(surveyData)) {
      if (typeof sectionData !== 'object' || sectionData === null) continue;

      for (const [fieldKey, fieldValue] of Object.entries(sectionData as Record<string, any>)) {
        // Only process if it's a rating field with a problematic value
        if (typeof fieldValue === 'string' && ['Poor', 'Inadequate', 'Fair'].includes(fieldValue)) {
          const result = await evaluateTriggers(surveyId, sectionKey, fieldKey, fieldValue);
          if (result.success) {
            totalAdded += result.recommendationsAdded;
          }
        }
      }
    }

    return { success: true, totalAdded };
  } catch (err: any) {
    console.error('Error in reevaluateAllTriggers:', err);
    return { success: false, totalAdded, error: err.message };
  }
}
