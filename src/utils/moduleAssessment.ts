export interface ModuleInstanceAssessmentShape {
  outcome?: string | null;
  assessor_notes?: string | null;
  data?: Record<string, unknown> | null;
}

export function resolveSectionAssessmentOutcome(moduleInstance: ModuleInstanceAssessmentShape): string {
  const dataOutcome =
    moduleInstance.data && typeof moduleInstance.data === 'object'
      ? (moduleInstance.data as Record<string, unknown>).section_assessment_outcome
      : undefined;

  return typeof dataOutcome === 'string' && dataOutcome.trim().length > 0
    ? dataOutcome
    : (moduleInstance.outcome ?? '');
}

export function resolveSectionAssessmentNotes(moduleInstance: ModuleInstanceAssessmentShape): string {
  const dataNotes =
    moduleInstance.data && typeof moduleInstance.data === 'object'
      ? (moduleInstance.data as Record<string, unknown>).section_assessment_notes
      : undefined;

  return typeof dataNotes === 'string' ? dataNotes : (moduleInstance.assessor_notes ?? '');
}

export function withResolvedSectionAssessment<T extends ModuleInstanceAssessmentShape>(moduleInstance: T): T {
  return {
    ...moduleInstance,
    outcome: resolveSectionAssessmentOutcome(moduleInstance),
    assessor_notes: resolveSectionAssessmentNotes(moduleInstance),
  } as T;
}