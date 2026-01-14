export interface RecommendationTemplate {
  fieldName: string;
  title: string;
  template: string;
}

export const recommendationTemplates: Record<string, RecommendationTemplate> = {
  commitmentLossPrevention_rating: {
    fieldName: 'commitmentLossPrevention_rating',
    title: 'Loss Prevention Commitment',
    template: 'Enhance management commitment to loss prevention by implementing a formal risk management programme with documented procedures, regular reviews, and clear accountability structures.',
  },
  fireEquipmentTesting_rating: {
    fieldName: 'fireEquipmentTesting_rating',
    title: 'Fire Equipment Testing',
    template: 'Establish a comprehensive fire equipment testing and maintenance programme with documented schedules, qualified personnel, and regular third-party verification to ensure all systems remain operational.',
  },
  controlHotWork_rating: {
    fieldName: 'controlHotWork_rating',
    title: 'Hot Work Controls',
    template: 'Implement a formal hot work permit system with pre-work inspections, fire watch procedures, and post-work monitoring to reduce ignition risks during maintenance activities.',
  },
  electricalMaintenance_rating: {
    fieldName: 'electricalMaintenance_rating',
    title: 'Electrical Maintenance',
    template: 'Upgrade electrical maintenance programme to include thermal imaging surveys, regular testing by qualified electricians, and immediate remediation of identified defects to prevent electrical fires.',
  },
  generalMaintenance_rating: {
    fieldName: 'generalMaintenance_rating',
    title: 'General Maintenance',
    template: 'Develop and implement a comprehensive maintenance programme with scheduled inspections, preventive maintenance tasks, and prompt repairs to maintain property condition and reduce fire risk.',
  },
  smokingControls_rating: {
    fieldName: 'smokingControls_rating',
    title: 'Smoking Controls',
    template: 'Strengthen smoking controls by designating safe smoking areas away from combustible materials, providing proper disposal receptacles, and enforcing no-smoking policies in high-risk zones.',
  },
  fireSafetyHousekeeping_rating: {
    fieldName: 'fireSafetyHousekeeping_rating',
    title: 'Housekeeping Standards',
    template: 'Improve housekeeping standards to minimise combustible loading by implementing regular cleaning schedules, proper waste management, and clear storage procedures that maintain adequate separation from ignition sources.',
  },
  selfInspections_rating: {
    fieldName: 'selfInspections_rating',
    title: 'Self-Inspection Programme',
    template: 'Establish a structured self-inspection programme with trained personnel, documented checklists, and corrective action tracking to identify and address fire safety deficiencies proactively.',
  },
  changeManagement_rating: {
    fieldName: 'changeManagement_rating',
    title: 'Change Management',
    template: 'Implement a formal change management process requiring risk assessment for all operational, process, or facility changes to ensure fire safety implications are identified and mitigated before implementation.',
  },
  contractorControls_rating: {
    fieldName: 'contractorControls_rating',
    title: 'Contractor Controls',
    template: 'Strengthen contractor control procedures by requiring site inductions, hot work permits, supervision during high-risk activities, and verification of contractor insurance and qualifications.',
  },
  impairmentHandling_rating: {
    fieldName: 'impairmentHandling_rating',
    title: 'Impairment Handling',
    template: 'Develop a formal impairment handling programme requiring notification to insurers, implementation of compensatory measures, expedited restoration timelines, and documented tracking of all system outages.',
  },
  emergencyResponse_rating: {
    fieldName: 'emergencyResponse_rating',
    title: 'Emergency Response',
    template: 'Enhance emergency response capability by developing site-specific emergency plans, conducting regular drills, training response teams, and establishing clear communication protocols with emergency services.',
  },
  fireDetectionNotes_rating: {
    fieldName: 'fireDetectionNotes_rating',
    title: 'Fire Detection Systems',
    template: 'Upgrade fire detection coverage to ensure early warning across all occupied and high-risk areas, in line with recognised standards such as BS 5839 or equivalent, with appropriate detector types for the hazards present.',
  },
  fireHydrantNotes_rating: {
    fieldName: 'fireHydrantNotes_rating',
    title: 'Fire Hydrant Provision',
    template: 'Improve fire hydrant provision and accessibility by installing additional hydrants to achieve adequate coverage, ensuring clear access routes, implementing regular flow testing, and addressing any defects identified.',
  },
  waterSupplyNotes_rating: {
    fieldName: 'waterSupplyNotes_rating',
    title: 'Water Supply',
    template: 'Enhance water supply reliability for firefighting by upgrading infrastructure, installing additional storage capacity, ensuring adequate flow rates and pressures, and implementing regular testing and maintenance.',
  },
  fire_protection_adequacy: {
    fieldName: 'fire_protection_adequacy',
    title: 'Fire Protection Adequacy',
    template: 'Upgrade fire protection systems to achieve adequate coverage levels in line with the risk profile. Install or extend automatic sprinkler protection to cover high-value and high-risk areas, ensuring compliance with recognised standards.',
  },
  water_supply_reliability: {
    fieldName: 'water_supply_reliability',
    title: 'Water Supply Reliability',
    template: 'Improve water supply reliability by upgrading mains connections, installing additional storage tanks or pumps, ensuring adequate flow rates and pressures for firefighting, and implementing regular flow testing and maintenance.',
  },
};

export function getRecommendationForRating(ratingField: string, currentValue: string): RecommendationTemplate | null {
  if ((currentValue === 'Poor' || currentValue === 'Inadequate' || currentValue === 'Unreliable') && recommendationTemplates[ratingField]) {
    return recommendationTemplates[ratingField];
  }
  return null;
}

export function shouldGenerateRecommendation(oldValue: string, newValue: string): boolean {
  // Generate if newly set to Poor, Inadequate, or Unreliable
  const isBadRating = newValue === 'Poor' || newValue === 'Inadequate' || newValue === 'Unreliable';
  const wasNotBadRating = oldValue !== 'Poor' && oldValue !== 'Inadequate' && oldValue !== 'Unreliable';

  return isBadRating && wasNotBadRating;
}
