/**
 * Survey Write-Lock Guards
 *
 * Enforces server-side immutability of issued surveys.
 * Once a survey is issued, no mutations are allowed until a new draft revision is created.
 *
 * CRITICAL: These guards must be called in ALL mutation endpoints that affect survey data.
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

export interface Survey {
  id: string;
  status: 'draft' | 'issued';
  current_revision: number;
  organisation_id: string | null;
  user_id: string;
}

export class SurveyLockedError extends Error {
  constructor(message: string = 'Survey is issued and locked. Create a revision to make changes.') {
    super(message);
    this.name = 'SurveyLockedError';
  }
}

export class SurveyNotFoundError extends Error {
  constructor(message: string = 'Survey not found or access denied') {
    super(message);
    this.name = 'SurveyNotFoundError';
  }
}

/**
 * Assert that a survey is editable (not issued).
 *
 * @throws {SurveyNotFoundError} if survey doesn't exist
 * @throws {SurveyLockedError} if survey is issued
 * @returns Survey data if editable
 *
 * Usage:
 * ```typescript
 * const survey = await assertSurveyEditable(supabase, survey_id);
 * // Proceed with mutation
 * ```
 */
export async function assertSurveyEditable(
  supabase: SupabaseClient,
  survey_id: string
): Promise<Survey> {
  const { data: survey, error } = await supabase
    .from('survey_reports')
    .select('id, status, current_revision, organisation_id, user_id')
    .eq('id', survey_id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching survey:', error);
    throw new SurveyNotFoundError('Failed to load survey');
  }

  if (!survey) {
    throw new SurveyNotFoundError();
  }

  if (survey.status === 'issued') {
    throw new SurveyLockedError();
  }

  return survey as Survey;
}

/**
 * Assert that a survey linked to an action is editable.
 *
 * Loads the action, then checks if its parent survey is editable.
 *
 * @throws {SurveyNotFoundError} if action or survey doesn't exist
 * @throws {SurveyLockedError} if survey is issued
 * @returns Survey data if editable
 *
 * Usage:
 * ```typescript
 * const survey = await assertActionSurveyEditable(supabase, action_id);
 * // Proceed with action mutation
 * ```
 */
export async function assertActionSurveyEditable(
  supabase: SupabaseClient,
  action_id: string
): Promise<Survey> {
  // Load the action to get survey_id
  const { data: action, error: actionError } = await supabase
    .from('survey_recommendations')
    .select('survey_id')
    .eq('id', action_id)
    .maybeSingle();

  if (actionError || !action) {
    throw new SurveyNotFoundError('Action not found or access denied');
  }

  // Check if parent survey is editable
  return assertSurveyEditable(supabase, action.survey_id);
}

/**
 * Check if a survey is issued (read-only check without throwing).
 *
 * @returns true if survey is issued, false otherwise
 *
 * Usage:
 * ```typescript
 * const isLocked = await isSurveyIssued(supabase, survey_id);
 * if (isLocked) {
 *   // Handle differently
 * }
 * ```
 */
export async function isSurveyIssued(
  supabase: SupabaseClient,
  survey_id: string
): Promise<boolean> {
  const { data: survey } = await supabase
    .from('survey_reports')
    .select('status')
    .eq('id', survey_id)
    .maybeSingle();

  return survey?.status === 'issued';
}

/**
 * Create standardized error response for locked surveys.
 *
 * Usage:
 * ```typescript
 * return createLockedSurveyResponse();
 * ```
 */
export function createLockedSurveyResponse(corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({
      error: 'Survey is issued and locked. Create a revision to make changes.',
      code: 'SURVEY_LOCKED'
    }),
    {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Create standardized error response for not found surveys.
 */
export function createNotFoundResponse(corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({
      error: 'Survey not found or access denied',
      code: 'SURVEY_NOT_FOUND'
    }),
    {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
