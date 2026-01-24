import { useState, useEffect } from 'react';
import { validateIssueEligibility, type ValidationResult, type Survey, type ModuleProgress, type Action } from '../utils/issueValidation';
import type { ValidationContext } from '../utils/issueRequirements';

interface UseIssueValidationProps {
  survey: Survey | null;
  answers: any;
  moduleProgress: ModuleProgress;
  actions: Action[];
}

interface UseIssueValidationReturn {
  validation: ValidationResult;
  isValidating: boolean;
  isReady: boolean;
  revalidate: () => Promise<void>;
}

/**
 * Hook to validate if a survey is ready for issuance
 */
export function useIssueValidation({
  survey,
  answers,
  moduleProgress,
  actions,
}: UseIssueValidationProps): UseIssueValidationReturn {
  const [validation, setValidation] = useState<ValidationResult>({
    eligible: false,
    blockers: [],
  });
  const [isValidating, setIsValidating] = useState(false);

  const revalidate = async () => {
    if (!survey) {
      setValidation({ eligible: false, blockers: [] });
      return;
    }

    setIsValidating(true);
    try {
      const result = await validateIssueEligibility(
        survey,
        answers,
        moduleProgress,
        actions
      );
      setValidation(result);
    } catch (error) {
      console.error('Error validating survey:', error);
      setValidation({
        eligible: false,
        blockers: [
          {
            type: 'module_incomplete',
            message: 'Validation error occurred',
          },
        ],
      });
    } finally {
      setIsValidating(false);
    }
  };

  useEffect(() => {
    revalidate();
  }, [survey, answers, moduleProgress, actions]);

  return {
    validation,
    isValidating,
    isReady: validation.eligible,
    revalidate,
  };
}
