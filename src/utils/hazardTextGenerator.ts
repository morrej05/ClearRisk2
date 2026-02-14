/**
 * Hazard Text Generation Utility
 *
 * Generates neutral, factual risk statements for recommendation library items.
 * No client names, insurer references, or "we/you/our" language.
 */

interface HazardTextInput {
  observation: string;
  actionRequired: string;
}

/**
 * Strip non-neutral terms and replace with neutral phrasing
 */
function neutralizeText(text: string): string {
  let neutralized = text;

  // Remove or replace non-neutral terms
  const replacements: Record<string, string> = {
    // Personal pronouns
    'you': 'the organisation',
    'your': 'the facility\'s',
    'we': 'the organisation',
    'our': 'the facility\'s',
    'us': 'the organisation',

    // Business terms to neutralize
    'client': 'the organisation',
    'insurer': 'risk management',
    'underwriter': 'risk assessment',
    'policy': 'risk management framework',
    'premium': 'risk exposure',
    'claim': 'loss event',
    'policyholder': 'the organisation',

    // Make more neutral
    'must': 'should',
    'immediately': 'promptly',
  };

  // Case-insensitive replacement
  Object.entries(replacements).forEach(([from, to]) => {
    const regex = new RegExp(`\\b${from}\\b`, 'gi');
    neutralized = neutralized.replace(regex, (match) => {
      // Preserve capitalization of first letter
      if (match[0] === match[0].toUpperCase()) {
        return to.charAt(0).toUpperCase() + to.slice(1);
      }
      return to;
    });
  });

  return neutralized;
}

/**
 * Extract key risk factors from observation text
 */
function extractRiskFactors(observation: string): string[] {
  const factors: string[] = [];

  // Keywords that indicate risk escalation
  const riskKeywords = [
    'inadequate', 'insufficient', 'lack of', 'missing', 'absent',
    'deficient', 'compromised', 'degraded', 'outdated', 'expired',
    'unprotected', 'exposed', 'vulnerable', 'uncontrolled'
  ];

  const lowerObs = observation.toLowerCase();
  riskKeywords.forEach(keyword => {
    if (lowerObs.includes(keyword)) {
      factors.push(keyword);
    }
  });

  return factors;
}

/**
 * Generate consequence statement based on action required
 */
function generateConsequence(actionRequired: string): string {
  const lowerAction = actionRequired.toLowerCase();

  // Fire-related
  if (lowerAction.includes('fire') || lowerAction.includes('flame') || lowerAction.includes('combusti')) {
    return 'Fire events could escalate beyond planned containment measures, increasing potential damage extent and recovery duration.';
  }

  // Water/leak related
  if (lowerAction.includes('water') || lowerAction.includes('leak') || lowerAction.includes('flood')) {
    return 'Water damage events could spread beyond initial affected areas, increasing downtime and restoration complexity.';
  }

  // Structural
  if (lowerAction.includes('structural') || lowerAction.includes('building') || lowerAction.includes('construction')) {
    return 'Structural inadequacies could compromise the integrity of adjacent systems during stress events, amplifying loss severity.';
  }

  // Life safety
  if (lowerAction.includes('evacuation') || lowerAction.includes('egress') || lowerAction.includes('escape') || lowerAction.includes('life safety')) {
    return 'Evacuation delays during emergency scenarios could increase occupant exposure to hazardous conditions.';
  }

  // Electrical
  if (lowerAction.includes('electrical') || lowerAction.includes('power') || lowerAction.includes('circuit')) {
    return 'Electrical fault scenarios could propagate beyond the point of origin, affecting critical operations and increasing downtime.';
  }

  // Management/procedural
  if (lowerAction.includes('procedure') || lowerAction.includes('training') || lowerAction.includes('management') || lowerAction.includes('document')) {
    return 'Procedural gaps reduce organizational preparedness, potentially slowing response effectiveness during emerging incidents.';
  }

  // Generic fallback
  return 'Unaddressed conditions increase the likelihood of loss events escalating beyond planned safeguards, extending recovery timeframes.';
}

/**
 * Generate mitigation benefit statement
 */
function generateBenefit(actionRequired: string): string {
  const lowerAction = actionRequired.toLowerCase();

  if (lowerAction.includes('install') || lowerAction.includes('implement') || lowerAction.includes('add')) {
    return 'Implementation of the recommended control strengthens overall facility resilience and reduces loss potential.';
  }

  if (lowerAction.includes('upgrade') || lowerAction.includes('replace') || lowerAction.includes('improve')) {
    return 'Upgrading this system enhances protective capabilities and reduces vulnerability to foreseeable scenarios.';
  }

  if (lowerAction.includes('maintain') || lowerAction.includes('inspect') || lowerAction.includes('test')) {
    return 'Regular maintenance sustains protective system reliability and ensures readiness when needed.';
  }

  if (lowerAction.includes('train') || lowerAction.includes('procedure') || lowerAction.includes('document')) {
    return 'Strengthening organizational preparedness improves response effectiveness and reduces incident duration.';
  }

  return 'Addressing this recommendation reduces overall facility risk exposure and enhances operational continuity.';
}

/**
 * Generate neutral hazard/risk description from observation and action required
 */
export function generateHazardText(input: HazardTextInput): string {
  if (!input.observation && !input.action_required) {
    return 'Inadequate controls increase the likelihood of loss events escalating beyond planned defenses. Foreseeable incidents could develop faster than current safeguards allow, increasing damage extent and recovery time. Strengthening this control reduces overall facility risk.';
  }

  // Neutralize inputs
  const observation = neutralizeText(input.observation || '');
  const actionRequired = neutralizeText(input.actionRequired || '');

  // Build the hazard statement (3 sentences)
  const sentences: string[] = [];

  // Sentence 1: Risk escalation (what can go wrong)
  const riskFactors = extractRiskFactors(observation);
  if (riskFactors.length > 0) {
    sentences.push(`Current conditions with ${riskFactors[0]} controls increase the likelihood of loss events escalating beyond planned defenses.`);
  } else {
    sentences.push('Inadequate controls increase the likelihood of loss events escalating beyond planned defenses.');
  }

  // Sentence 2: Consequence (impact)
  sentences.push(generateConsequence(actionRequired));

  // Sentence 3: Benefit (mitigation value)
  sentences.push(generateBenefit(actionRequired));

  return sentences.join(' ');
}

/**
 * Validate that hazard text is neutral (no prohibited terms)
 */
export function validateHazardNeutrality(text: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const lowerText = text.toLowerCase();

  // Prohibited terms
  const prohibited = [
    { term: 'you', message: 'Contains "you" - use neutral third person' },
    { term: 'your', message: 'Contains "your" - use "the facility\'s"' },
    { term: 'we ', message: 'Contains "we" - use "the organisation"' },
    { term: 'our ', message: 'Contains "our" - use "the facility\'s"' },
    { term: 'client', message: 'Contains "client" - use "the organisation"' },
    { term: 'insurer', message: 'Contains "insurer" - remove insurance references' },
    { term: 'underwriter', message: 'Contains "underwriter" - remove insurance references' },
    { term: 'policy', message: 'Contains "policy" - use "framework" or remove' },
    { term: 'premium', message: 'Contains "premium" - remove pricing references' },
  ];

  prohibited.forEach(({ term, message }) => {
    if (lowerText.includes(term)) {
      issues.push(message);
    }
  });

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Example hazard texts for testing/reference
 */
export const EXAMPLE_HAZARD_TEXTS = {
  fireProtection: 'Inadequate fire suppression capability increases the likelihood of fire events extending beyond the area of origin. A foreseeable ignition event could develop faster than manual intervention allows, increasing potential damage to adjacent spaces and contents. Installing automatic suppression reduces fire spread potential and associated downtime.',

  structural: 'Structural deficiencies compromise load-bearing capacity under stress conditions. Seismic or wind events could exceed design thresholds, potentially affecting building integrity and occupant safety. Strengthening structural elements enhances resilience to environmental forces.',

  waterDamage: 'Aging pipe infrastructure increases the probability of uncontrolled water release. A rupture scenario could discharge significant volumes before isolation, affecting equipment and operations across multiple floors. Replacing high-risk piping sections reduces water damage exposure.',

  management: 'Procedural gaps reduce organizational readiness for emergency scenarios. Response delays during evolving incidents could extend exposure duration and complicate recovery efforts. Implementing structured emergency procedures improves response effectiveness and outcome predictability.',
};
