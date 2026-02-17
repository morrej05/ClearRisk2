/**
 * Report Quality Gates & Validation
 *
 * Validates report completeness and data quality before PDF generation.
 * Detects placeholders, missing IDs, empty commentary, and other issues.
 */

interface ModuleInstance {
  id: string;
  module_key: string;
  outcome: string | null;
  assessor_notes: string;
  data: Record<string, any>;
  completed_at: string | null;
  updated_at: string;
}

export interface QualityIssue {
  type: 'placeholder' | 'missing_action_id' | 'empty_commentary' | 'missing_outcome';
  severity: 'blocking' | 'warning';
  message: string;
  moduleKey?: string;
  field?: string;
}

export interface QualityGateResult {
  passed: boolean;
  blockingIssues: QualityIssue[];
  warnings: QualityIssue[];
  assuranceGaps: string[]; // Compact 2-item max list for PDF
}

/**
 * Common placeholder patterns to detect
 */
const PLACEHOLDER_PATTERNS = [
  /\[.*?\]/i, // [placeholder text]
  /\{.*?\}/i, // {placeholder}
  /TODO:/i,
  /TBC/i,
  /TBD/i,
  /PENDING/i,
  /AWAITING/i,
  /INSERT\s/i,
  /PLACEHOLDER/i,
  /XXX/i,
  /N\/A\s*-\s*awaiting/i,
];

/**
 * Check if text contains placeholder patterns
 */
function containsPlaceholder(text: string | null | undefined): boolean {
  if (!text || text.trim().length === 0) return false;

  const normalizedText = text.trim();

  // Check against patterns
  return PLACEHOLDER_PATTERNS.some(pattern => pattern.test(normalizedText));
}

/**
 * Check if commentary is effectively empty (too short, placeholder, or missing)
 */
function isEmptyCommentary(text: string | null | undefined): boolean {
  if (!text || text.trim().length === 0) return true;

  const trimmed = text.trim();

  // Too short to be meaningful (less than 10 characters)
  if (trimmed.length < 10) return true;

  // Common non-informative phrases
  const nonInformative = [
    /^n\/?a$/i,
    /^none$/i,
    /^nil$/i,
    /^-$/,
    /^\.$/,
    /^ok$/i,
    /^good$/i,
    /^see above$/i,
    /^as above$/i,
    /^tbc$/i,
  ];

  if (nonInformative.some(pattern => pattern.test(trimmed))) {
    return true;
  }

  return false;
}

/**
 * Validate actions for quality issues
 */
function validateActions(actions: any[]): QualityIssue[] {
  const issues: QualityIssue[] = [];

  for (const action of actions) {
    // Check for missing reference IDs (should be auto-generated)
    if (!action.reference_number) {
      issues.push({
        type: 'missing_action_id',
        severity: 'warning',
        message: `Action missing reference number: "${action.recommended_action?.substring(0, 50) || 'Unknown'}"`,
      });
    }

    // Check for placeholder text in action description
    if (containsPlaceholder(action.recommended_action)) {
      issues.push({
        type: 'placeholder',
        severity: 'blocking',
        message: `Action contains placeholder text: "${action.recommended_action?.substring(0, 50)}"`,
      });
    }

    // Check for empty/minimal action text
    if (!action.recommended_action || action.recommended_action.trim().length < 15) {
      issues.push({
        type: 'empty_commentary',
        severity: 'blocking',
        message: 'Action description is too short or missing',
      });
    }
  }

  return issues;
}

/**
 * Validate module instances for quality issues
 */
function validateModules(modules: ModuleInstance[]): QualityIssue[] {
  const issues: QualityIssue[] = [];

  for (const module of modules) {
    // Check for missing outcomes in completed modules
    if (module.completed_at && !module.outcome) {
      issues.push({
        type: 'missing_outcome',
        severity: 'warning',
        message: `Module "${module.module_key}" is marked complete but has no outcome`,
        moduleKey: module.module_key,
      });
    }

    // Check assessor notes for placeholders
    if (containsPlaceholder(module.assessor_notes)) {
      issues.push({
        type: 'placeholder',
        severity: 'blocking',
        message: `Module "${module.module_key}" contains placeholder text in assessor notes`,
        moduleKey: module.module_key,
        field: 'assessor_notes',
      });
    }

    // Check for empty commentary in completed modules
    if (module.completed_at && isEmptyCommentary(module.assessor_notes)) {
      issues.push({
        type: 'empty_commentary',
        severity: 'warning',
        message: `Module "${module.module_key}" is complete but has minimal/no assessor commentary`,
        moduleKey: module.module_key,
        field: 'assessor_notes',
      });
    }

    // Check data fields for common placeholders
    if (module.data) {
      for (const [key, value] of Object.entries(module.data)) {
        if (typeof value === 'string' && containsPlaceholder(value)) {
          issues.push({
            type: 'placeholder',
            severity: 'blocking',
            message: `Module "${module.module_key}" field "${key}" contains placeholder text`,
            moduleKey: module.module_key,
            field: key,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Generate compact assurance gaps summary (max 2 items for PDF)
 */
function generateAssuranceGaps(issues: QualityIssue[]): string[] {
  const gaps: string[] = [];

  // Count issues by type
  const placeholderCount = issues.filter(i => i.type === 'placeholder').length;
  const emptyCommentaryCount = issues.filter(i => i.type === 'empty_commentary').length;
  const missingOutcomeCount = issues.filter(i => i.type === 'missing_outcome').length;

  // Generate summary statements (max 2)
  if (placeholderCount > 0) {
    gaps.push(`${placeholderCount} field${placeholderCount > 1 ? 's' : ''} contain placeholder text requiring completion`);
  }

  if (emptyCommentaryCount > 0 && gaps.length < 2) {
    gaps.push(`${emptyCommentaryCount} module${emptyCommentaryCount > 1 ? 's' : ''} lack assessor commentary`);
  }

  if (missingOutcomeCount > 0 && gaps.length < 2) {
    gaps.push(`${missingOutcomeCount} completed module${missingOutcomeCount > 1 ? 's' : ''} missing outcome ratings`);
  }

  return gaps.slice(0, 2); // Strict max 2 items
}

/**
 * Run quality gate validation on report data
 */
export function validateReportQuality(
  modules: ModuleInstance[],
  actions: any[]
): QualityGateResult {
  const allIssues: QualityIssue[] = [];

  // Validate modules
  allIssues.push(...validateModules(modules));

  // Validate actions
  allIssues.push(...validateActions(actions));

  // Separate blocking vs warnings
  const blockingIssues = allIssues.filter(i => i.severity === 'blocking');
  const warnings = allIssues.filter(i => i.severity === 'warning');

  // Generate assurance gaps for PDF
  const assuranceGaps = generateAssuranceGaps([...blockingIssues, ...warnings]);

  return {
    passed: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    assuranceGaps,
  };
}

/**
 * Standardize outcome language (critical vs governance)
 *
 * Maps raw outcome values to standardized labels for professional reports.
 */
export function standardizeOutcomeLabel(outcome: string | null | undefined): string {
  if (!outcome) return 'Not Assessed';

  const normalized = outcome.toLowerCase().trim();

  // Critical deficiency outcomes
  if (normalized.includes('critical') || normalized.includes('immediate')) {
    return 'Critical Deficiency';
  }

  // Material deficiency outcomes
  if (normalized.includes('material') || normalized.includes('significant')) {
    return 'Material Deficiency';
  }

  // Governance/minor outcomes
  if (normalized.includes('governance') || normalized.includes('observation') || normalized.includes('minor')) {
    return 'Governance Issue';
  }

  // Compliant outcomes
  if (normalized.includes('compliant') || normalized.includes('satisfactory') || normalized.includes('adequate')) {
    return 'Compliant';
  }

  // Partial compliance
  if (normalized.includes('partial')) {
    return 'Partially Compliant';
  }

  // Default: capitalize first letter of each word
  return outcome
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Generate stable action reference ID
 *
 * Format: FRA-DOC-{shortDocId}-{sequenceNumber}
 * Example: FRA-DOC-A3F2-001
 */
export function generateActionReferenceId(
  documentId: string,
  sequenceNumber: number,
  documentType: string = 'FRA'
): string {
  // Take last 4 chars of document ID for uniqueness
  const shortId = documentId.slice(-4).toUpperCase();

  // Zero-pad sequence number to 3 digits
  const paddedSeq = sequenceNumber.toString().padStart(3, '0');

  return `${documentType}-DOC-${shortId}-${paddedSeq}`;
}

/**
 * Check if action owner should be displayed or suppressed
 *
 * Returns null if owner is "(Unassigned)" or similar noise.
 */
export function getDisplayableOwner(owner: string | null | undefined): string | null {
  if (!owner || owner.trim().length === 0) return null;

  const normalized = owner.toLowerCase().trim();

  // Suppress common noise values
  const suppressPatterns = [
    'unassigned',
    'not assigned',
    'n/a',
    'tbc',
    'tbd',
    'pending',
  ];

  if (suppressPatterns.some(pattern => normalized.includes(pattern))) {
    return null;
  }

  return owner;
}
