/**
 * Section Summary Generator for FRA PDF Sections 5-12
 *
 * Generates professional assessor summaries that appear at the top of each technical section
 * Based on module outcomes and info gaps
 */

import type { ModuleInstance } from '../supabase/attachments';

interface SectionContext {
  sectionId: number;
  sectionTitle: string;
  moduleInstances: ModuleInstance[];
}

/**
 * Generate professional assessor summary for a section
 * Returns 2-4 line narrative based on module outcomes
 */
export function generateSectionSummary(context: SectionContext): string | null {
  const { sectionId, sectionTitle, moduleInstances } = context;

  // Only generate summaries for sections 5-12 (technical assessment sections)
  if (sectionId < 5 || sectionId > 12) return null;

  // If no modules in section, no summary needed
  if (moduleInstances.length === 0) return null;

  // Analyze outcomes
  const hasMaterialDef = moduleInstances.some(m => m.outcome === 'material_def');
  const hasMinorDef = moduleInstances.some(m => m.outcome === 'minor_def');
  const hasInfoGap = moduleInstances.some(m => m.outcome === 'info_gap');
  const allCompliant = moduleInstances.every(m => m.outcome === 'compliant' || !m.outcome);

  // Count info gaps
  const infoGapCount = moduleInstances.filter(m => m.outcome === 'info_gap').length;

  // Generate context-aware narrative based on section and outcomes
  let summary = '';

  if (hasMaterialDef) {
    summary = generateMaterialDefSummary(sectionId, sectionTitle, hasInfoGap);
  } else if (hasMinorDef) {
    summary = generateMinorDefSummary(sectionId, sectionTitle, hasInfoGap);
  } else if (hasInfoGap) {
    summary = generateInfoGapSummary(sectionId, sectionTitle, infoGapCount);
  } else if (allCompliant) {
    summary = generateCompliantSummary(sectionId, sectionTitle);
  } else {
    // Fallback for modules without explicit outcomes
    summary = generateNeutralSummary(sectionId, sectionTitle);
  }

  return summary;
}

function generateMaterialDefSummary(sectionId: number, sectionTitle: string, hasInfoGap: boolean): string {
  const summaries: Record<number, string> = {
    5: `Significant fire hazards requiring urgent attention have been identified. ${hasInfoGap ? 'Certain areas could not be fully assessed due to access restrictions.' : 'Immediate action is required to reduce ignition sources and manage combustible materials.'}`,

    6: `Significant deficiencies in means of escape have been identified which could compromise safe evacuation. ${hasInfoGap ? 'Some escape routes could not be fully verified.' : 'These deficiencies require urgent remediation to ensure occupant safety.'}`,

    7: `Material deficiencies in fire detection and alarm systems have been identified. ${hasInfoGap ? 'Certain detection zones could not be fully assessed.' : 'The current provision does not provide adequate early warning of fire.'}`,

    8: `Emergency lighting provision has significant deficiencies which could compromise safe evacuation in emergency conditions. ${hasInfoGap ? 'Some areas could not be fully assessed.' : 'Urgent improvements are required to meet regulatory standards.'}`,

    9: `Significant breaches in compartmentation and fire separation have been identified. ${hasInfoGap ? 'Certain concealed spaces could not be accessed for full assessment.' : 'These deficiencies compromise the building\'s ability to contain fire spread and must be addressed urgently.'}`,

    10: `Fixed fire suppression and firefighting equipment have material deficiencies. ${hasInfoGap ? 'Some systems could not be fully tested.' : 'Current provision may not be adequate for the fire risk present.'}`,

    11: `Significant gaps in fire safety management systems have been identified. ${hasInfoGap ? 'Certain management records could not be fully reviewed.' : 'Immediate improvements to procedures, training, and record-keeping are required.'}`,

    12: `Significant risks of external fire spread have been identified. ${hasInfoGap ? 'Certain aspects of external boundaries could not be fully assessed.' : 'These risks require urgent attention to prevent fire spread to or from adjacent properties.'}`,
  };

  return summaries[sectionId] || 'Significant deficiencies requiring urgent attention have been identified in this area.';
}

function generateMinorDefSummary(sectionId: number, sectionTitle: string, hasInfoGap: boolean): string {
  const summaries: Record<number, string> = {
    5: `Minor deficiencies in fire hazard management have been identified. ${hasInfoGap ? 'Some areas could not be fully assessed. ' : ''}Improvements are recommended to further reduce fire risk.`,

    6: `Means of escape provision is generally adequate with minor improvements required. ${hasInfoGap ? 'Certain routes could not be fully verified. ' : ''}The identified deficiencies should be addressed to enhance safety.`,

    7: `Fire detection and alarm systems are generally adequate with minor improvements required. ${hasInfoGap ? 'Some detection zones could not be fully assessed. ' : ''}The system provides reasonable early warning with scope for enhancement.`,

    8: `Emergency lighting is generally provided with minor deficiencies identified. ${hasInfoGap ? 'Some areas could not be fully assessed. ' : ''}Improvements are recommended to ensure full compliance.`,

    9: `Compartmentation is generally adequate with minor improvements required. ${hasInfoGap ? 'Some concealed spaces could not be accessed. ' : ''}The identified deficiencies should be addressed to maintain fire separation integrity.`,

    10: `Fixed fire suppression and firefighting equipment are generally adequate with minor improvements required. ${hasInfoGap ? 'Some systems could not be fully tested. ' : ''}The provision is reasonable for the fire risk present.`,

    11: `Fire safety management systems are generally adequate with minor improvements recommended. ${hasInfoGap ? 'Certain records could not be fully reviewed. ' : ''}Enhanced procedures and training would further improve fire safety standards.`,

    12: `External fire spread risks are generally managed with minor improvements required. ${hasInfoGap ? 'Some external boundaries could not be fully assessed. ' : ''}The identified measures should be enhanced to minimize fire spread potential.`,
  };

  return summaries[sectionId] || 'Minor deficiencies have been identified. Improvements are recommended to enhance fire safety standards.';
}

function generateInfoGapSummary(sectionId: number, sectionTitle: string, infoGapCount: number): string {
  const areaWord = infoGapCount > 1 ? 'areas' : 'an area';
  const couldWord = infoGapCount > 1 ? 'areas could' : 'this area could';

  const summaries: Record<number, string> = {
    5: `Fire hazards were generally controlled where assessed. However, ${areaWord} could not be fully evaluated due to access restrictions or missing information. The overall assessment is provisional pending complete access.`,

    6: `Means of escape provision appears adequate in accessible areas. However, ${couldWord} not be fully verified due to restricted access or incomplete information. Travel distances and exit routes should be confirmed when full access is available.`,

    7: `Fire detection and alarm provision appears adequate where assessed. However, ${couldWord} not be fully verified due to access restrictions or incomplete system documentation. Full verification is required.`,

    8: `Emergency lighting appears adequate where observed. However, ${couldWord} not be fully assessed due to access restrictions or testing limitations. Comprehensive testing should be conducted when full access is available.`,

    9: `Compartmentation appears adequate where accessible. However, ${couldWord} not be fully assessed due to restricted access to concealed spaces or incomplete documentation. Full assessment should be completed when access permits.`,

    10: `Fixed firefighting equipment appears adequate where inspected. However, ${couldWord} not be fully verified due to access restrictions or incomplete testing. Full verification should be conducted.`,

    11: `Fire safety management systems appear adequate based on available evidence. However, ${couldWord} not be fully evaluated due to incomplete records or unavailable personnel. Full review should be completed when all documentation is available.`,

    12: `External fire spread risks appear managed where assessed. However, ${couldWord} not be fully evaluated due to restricted access to boundaries or incomplete information. Full assessment should be completed when access permits.`,
  };

  return summaries[sectionId] || `Certain aspects could not be fully verified due to missing information or restricted access. The assessment in this area is provisional.`;
}

function generateCompliantSummary(sectionId: number, sectionTitle: string): string {
  const summaries: Record<number, string> = {
    5: 'Fire hazards are appropriately controlled and managed. No significant deficiencies were identified in the assessment of ignition sources and combustible materials.',

    6: 'Means of escape provision is adequate for the occupancy. Escape routes, travel distances, signage, and emergency lighting meet regulatory requirements.',

    7: 'Fire detection and alarm systems are adequate for the occupancy and fire risk. The system provides appropriate early warning of fire and is properly maintained.',

    8: 'Emergency lighting provision is adequate and meets regulatory standards. Lighting is appropriately positioned to facilitate safe evacuation in emergency conditions.',

    9: 'Compartmentation and passive fire protection measures are adequate. Fire doors, fire stopping, and structural fire resistance meet regulatory requirements.',

    10: 'Fixed fire suppression and firefighting equipment are adequate for the occupancy and fire risk. Equipment is appropriately maintained and accessible.',

    11: 'Fire safety management systems are adequate. Appropriate procedures, training, and maintenance regimes are in place and effectively implemented.',

    12: 'External fire spread risks are appropriately managed. Adequate separation distances and fire resistance are provided to prevent fire spread to or from adjacent properties.',
  };

  return summaries[sectionId] || 'No significant deficiencies were identified in this area. Provisions meet regulatory requirements.';
}

function generateNeutralSummary(sectionId: number, sectionTitle: string): string {
  // Fallback for modules without explicit outcomes
  return 'This section has been assessed in accordance with regulatory requirements. Detailed findings are provided below.';
}
