import { supabase } from '../supabase';
import { canGenerateAiSummary } from '../../utils/entitlements';

interface GenerateExecutiveSummaryOptions {
  documentId: string;
  organisationId: string;
}

interface ModuleOutcome {
  module_key: string;
  outcome: string | null;
  data?: any;
}

interface ActionCount {
  P1: number;
  P2: number;
  P3: number;
  P4: number;
}

export async function generateExecutiveSummary(
  options: GenerateExecutiveSummaryOptions
): Promise<{ success: boolean; summary?: string; error?: string }> {
  const { documentId, organisationId } = options;

  try {
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('organisation_id', organisationId)
      .maybeSingle();

    if (docError || !document) {
      return { success: false, error: 'Document not found' };
    }

    const { data: organisation, error: orgError } = await supabase
      .from('organisations')
      .select('*')
      .eq('id', organisationId)
      .maybeSingle();

    if (orgError || !organisation) {
      return { success: false, error: 'Organisation not found' };
    }

    if (!canGenerateAiSummary(organisation)) {
      return {
        success: false,
        error: 'Executive summaries are available on the Professional plan. Upgrade to access this feature.',
      };
    }

    if (document.issue_status !== 'draft') {
      return {
        success: false,
        error: 'Cannot generate summary for issued or superseded documents',
      };
    }

    const { data: modules, error: modulesError } = await supabase
      .from('module_instances')
      .select('module_key, outcome, data')
      .eq('document_id', documentId);

    if (modulesError) {
      return { success: false, error: 'Failed to fetch module data' };
    }

    const { data: actions, error: actionsError } = await supabase
  .from('actions')
  .select('priority_band, status')
  .eq('document_id', documentId)
  .is('deleted_at', null);

    if (actionsError) {
      return { success: false, error: 'Failed to fetch action data' };
    }
    
    const openActions = (actions ?? []).filter(
      (a) => String(a?.status ?? '').toLowerCase() === 'open'
    );
    
    const moduleOutcomes = (modules || []) as ModuleOutcome[];
    
    const actionCounts: ActionCount = { P1: 0, P2: 0, P3: 0, P4: 0 };
    
    openActions.forEach((action: any) => {
      const band = action.priority_band;
      if (band && band in actionCounts) {
        actionCounts[band as keyof ActionCount]++;
      }
    });
    
    const summary = buildExecutiveSummary(
      document.document_type,
      document.title,
      document.assessment_date,
      document.scope_description,
      document.limitations_assumptions,
      moduleOutcomes,
      actionCounts
    );

    const { error: updateError } = await supabase
      .from('documents')
      .update({
        executive_summary_ai: summary,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId)
      .eq('organisation_id', organisationId);

    if (updateError) {
      return { success: false, error: 'Failed to save executive summary' };
    }

    return { success: true, summary };
  } catch (error: any) {
    console.error('Error generating executive summary:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}

function buildExecutiveSummary(
  documentType: string,
  title: string,
  assessmentDate: string,
  scope: string | null,
  limitations: string | null,
  modules: ModuleOutcome[],
  actionCounts: ActionCount
): string {
  if (documentType === 'DSEAR') {
    return buildDsearExecutiveSummary(title, assessmentDate, scope, limitations, modules, actionCounts);
  } else if (documentType === 'FSD') {
    return buildFsdExecutiveSummary(title, assessmentDate, scope, limitations, modules, actionCounts);
  } else {
    const snapshotLines = buildFraSnapshotLines(modules);

return buildFraExecutiveSummary(
  title,
  assessmentDate,
  scope,
  limitations,
  modules,
  actionCounts,
  snapshotLines
);
  }
}

function buildFraSnapshotLines(modules: ModuleOutcome[]): string[] {
  const a2 = modules.find(m => m.module_key === 'A2_BUILDING_PROFILE')?.data || {};
  const a3 = modules.find(m => m.module_key === 'A3_PERSONS_AT_RISK')?.data || {};
  const a8 = modules.find(m => m.module_key === 'FRA_8_FIREFIGHTING_EQUIPMENT')?.data || {};
  const a3Prot = modules.find(m => m.module_key === 'FRA_3_PROTECTION_ASIS')?.data || {};

  const buildingUseLabels: Record<string, string> = {
    hmo: 'HMO',
    block_of_flats_purpose_built: 'Purpose-built block of flats',
    converted_flats: 'Converted flats',
    hotel_hostel: 'Hotel / hostel',
    care_home: 'Care home',
    office: 'Office',
    retail: 'Retail',
    industrial_warehouse: 'Industrial / warehouse',
    educational: 'Educational',
    healthcare_non_residential: 'Healthcare (non-residential)',
    assembly_leisure: 'Assembly / leisure',
    mixed_use: 'Mixed use',
    other: 'Other',
  };

  const occupancyProfileLabels: Record<string, string> = {
    office: 'Office',
    industrial: 'Industrial',
    public_access: 'Public access',
    sleeping: 'Sleeping risk',
    healthcare: 'Healthcare',
    education: 'Education',
    other: 'Other',
  };

  const facts1: string[] = [];
  const facts2: string[] = [];

  // Use
  const buildingUse = a2.building_use_uk;
  if (buildingUse && buildingUse !== 'unknown') {
    const label = buildingUseLabels[buildingUse];
    if (label) {
      if (buildingUse === 'other' && a2.building_use_other) {
        facts1.push(`Use: ${label} (${a2.building_use_other})`);
      } else {
        facts1.push(`Use: ${label}`);
      }
    }
  }

  // Occupancy (optional, only if present and not unknown)
  const occupancyProfile = a3.occupancy_profile;
  if (occupancyProfile && occupancyProfile !== 'unknown') {
    const label = occupancyProfileLabels[occupancyProfile];
    if (label) {
      facts1.push(`Occupancy: ${label}`);
    }
  }

  // Storeys
  if (a2.storeys_exact) {
    facts2.push(`Storeys: ${a2.storeys_exact}`);
  } else if (a2.storeys_band) {
    facts2.push(`Storeys: ${a2.storeys_band}`);
  }

  // Sprinklers (nested preferred)
  const sprinkler =
    a8?.firefighting?.fixed_facilities?.sprinklers?.installed ??
    a3Prot?.firefighting?.fixed_facilities?.sprinklers?.installed ??
    a8?.sprinkler_present ??
    null;

  if (sprinkler === 'yes') facts2.push('Sprinklers: Present');
  if (sprinkler === 'no') facts2.push('Sprinklers: Not present');

  // Out of hours
  if (a3.out_of_hours_occupation === 'yes') {
    facts2.push('Out-of-hours occupation: Yes');
  }
  if (a3.out_of_hours_occupation === 'no') {
    facts2.push('Out-of-hours occupation: No');
  }

  const snapshotLines: string[] = [];
  if (facts1.length) snapshotLines.push(facts1.join(' • '));
  if (facts2.length) snapshotLines.push(facts2.join(' | '));

  return snapshotLines.slice(0, 2);
}
function buildFraExecutiveSummary(
  title: string,
  assessmentDate: string,
  scope: string | null,
  limitations: string | null,
  modules: ModuleOutcome[],
  actionCounts: ActionCount,
  snapshotLines?: string[]
): string {
  const date = new Date(assessmentDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const totalActions =
    actionCounts.P1 + actionCounts.P2 + actionCounts.P3 + actionCounts.P4;

  const compliantCount = modules.filter((m) => m.outcome === 'compliant').length;
  const minorDefCount = modules.filter((m) => m.outcome === 'minor_def').length;
  const materialDefCount = modules.filter((m) => m.outcome === 'material_def').length;
  const infoGapCount = modules.filter((m) => m.outcome === 'info_gap').length;
  const totalModules = modules.length;

  const bullets: string[] = [];

// Snapshot first (if available)
if (snapshotLines && snapshotLines.length > 0) {
  bullets.push(...snapshotLines);
}

// Then standard intro line
const trimmedScope = scope?.trim().replace(/[.,;]+$/, '') || '';
bullets.push(
  `Assessment Date: ${date}${trimmedScope ? ` covering ${trimmedScope}` : ''}.`
);

  bullets.push(
    `${totalModules} key area${totalModules !== 1 ? 's' : ''} of fire safety were assessed.`
  );

  if (materialDefCount > 0) {
    bullets.push(
      `${materialDefCount} area${materialDefCount > 1 ? 's' : ''} with material deficiencies requiring immediate attention were identified.`
    );
  }

  if (minorDefCount > 0) {
    bullets.push(
      `${minorDefCount} area${minorDefCount > 1 ? 's' : ''} with minor deficiencies were found.`
    );
  }

  if (compliantCount === totalModules && totalModules > 0) {
    bullets.push(
      'All assessed areas were found to be compliant with current fire safety standards and regulations.'
    );
  }

  if (infoGapCount > 0) {
    bullets.push(
      `${infoGapCount} area${infoGapCount > 1 ? 's' : ''} where further information is required to complete the assessment.`
    );
  }

  if (totalActions > 0) {
    const actionParts: string[] = [];

    if (actionCounts.P1 > 0) {
      actionParts.push(
        `${actionCounts.P1} high priority (P1) action${actionCounts.P1 > 1 ? 's' : ''}`
      );
    }
    if (actionCounts.P2 > 0) {
      actionParts.push(
        `${actionCounts.P2} medium-high priority (P2) action${actionCounts.P2 > 1 ? 's' : ''}`
      );
    }
    if (actionCounts.P3 > 0) {
      actionParts.push(
        `${actionCounts.P3} medium priority (P3) action${actionCounts.P3 > 1 ? 's' : ''}`
      );
    }
    if (actionCounts.P4 > 0) {
      actionParts.push(
        `${actionCounts.P4} lower priority (P4) improvement${actionCounts.P4 > 1 ? 's' : ''}`
      );
    }

    const joinedActions =
      actionParts.length === 1 ? actionParts[0] :
      actionParts.length === 2 ? `${actionParts[0]} and ${actionParts[1]}` :
      actionParts.slice(0, -1).join(', ') + ', and ' + actionParts[actionParts.length - 1];

    bullets.push(
      `${totalActions} recommendation${totalActions > 1 ? 's have' : ' has'} been made: ${joinedActions}.`
    );
  } else {
    bullets.push(
      'No specific recommendations have been made at this time. Continued maintenance of existing fire safety measures and regular review of arrangements are advised.'
    );
  }

  if (limitations) {
    bullets.push(
      `Assessment limitations: ${limitations.slice(0, 150)}${limitations.length > 150 ? '...' : ''}`
    );
  }

  // Severity-aware closing statement (deterministic)
  let closing = '';

  const hasP1 = actionCounts.P1 > 0;
  const hasP2 = actionCounts.P2 > 0;

  if (hasP1) {
    closing =
      'Immediate attention is required to address the highest-priority actions identified. These items should be progressed without delay to reduce life safety risk and support compliance with applicable fire safety duties.';
  } else if (hasP2) {
    closing =
      'Material improvements are required to address identified deficiencies. Actions should be implemented in line with their assigned priority to strengthen overall fire safety performance.';
  } else if (totalActions > 0) {
    closing =
      'The identified actions represent targeted improvements to enhance existing fire safety controls. Implementation should be managed in line with operational planning and risk prioritisation.';
  } else {
    closing =
      'No material deficiencies were identified at the time of assessment. Existing fire safety arrangements were found to be broadly appropriate to the use and occupancy.';
  }

  closing +=
    ' Full details of the assessment findings and recommendations are provided within the main body of this report.';

  const bulletSection = bullets.map((b) => `• ${b}`).join('\n');
  return `${bulletSection}\n\n${closing}`;
}

function buildDsearExecutiveSummary(
  title: string,
  assessmentDate: string,
  scope: string | null,
  limitations: string | null,
  modules: ModuleOutcome[],
  actionCounts: ActionCount
): string {
  const date = new Date(assessmentDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const totalActions =
    actionCounts.P1 + actionCounts.P2 + actionCounts.P3 + actionCounts.P4;

  const compliantCount = modules.filter((m) => m.outcome === 'compliant').length;
  const minorDefCount = modules.filter((m) => m.outcome === 'minor_def').length;
  const materialDefCount = modules.filter(
    (m) => m.outcome === 'material_def'
  ).length;
  const infoGapCount = modules.filter((m) => m.outcome === 'info_gap').length;
  const totalModules = modules.length;

  const bullets: string[] = [];

  bullets.push(
    `Assessment Date: ${date}${scope ? ` covering ${scope.trim()}` : ''}.`
  );

  bullets.push(
    `${totalModules} key area${
      totalModules !== 1 ? 's' : ''
    } of explosion risk and dangerous substance management were examined to identify hazards, evaluate controls, and determine necessary actions.`
  );

  if (materialDefCount > 0) {
    bullets.push(
      `${materialDefCount} area${
        materialDefCount > 1 ? 's' : ''
      } with material deficiencies requiring immediate attention were identified to prevent potential explosion incidents.`
    );
  }

  if (minorDefCount > 0) {
    bullets.push(
      `${minorDefCount} area${
        minorDefCount > 1 ? 's' : ''
      } with minor deficiencies were found and should be addressed to maintain robust explosion protection.`
    );
  }

  if (compliantCount === totalModules && totalModules > 0) {
    bullets.push(
      'All assessed areas were found to be compliant with current DSEAR regulations and industry best practice for explosion safety.'
    );
  }

  if (infoGapCount > 0) {
    bullets.push(
      `${infoGapCount} area${
        infoGapCount > 1 ? 's' : ''
      } where further information or specialist assessment is required to complete the explosion risk evaluation.`
    );
  }

  if (totalActions > 0) {
    const actionParts: string[] = [];
    if (actionCounts.P1 > 0) {
      actionParts.push(
        `${actionCounts.P1} high priority (P1) action${actionCounts.P1 > 1 ? 's' : ''}`
      );
    }
    if (actionCounts.P2 > 0) {
      actionParts.push(
        `${actionCounts.P2} medium-high priority (P2) action${
          actionCounts.P2 > 1 ? 's' : ''
        }`
      );
    }
    if (actionCounts.P3 > 0) {
      actionParts.push(
        `${actionCounts.P3} medium priority (P3) action${actionCounts.P3 > 1 ? 's' : ''}`
      );
    }
    if (actionCounts.P4 > 0) {
      actionParts.push(
        `${actionCounts.P4} lower priority (P4) improvement${
          actionCounts.P4 > 1 ? 's' : ''
        }`
      );
    }

    bullets.push(
      `${totalActions} recommendation${
        totalActions > 1 ? 's have' : ' has'
      } been made: ${actionParts.join(', ')}.`
    );
  } else {
    bullets.push(
      'No specific recommendations have been made at this time. Continued maintenance of existing explosion protection measures and regular review of DSEAR compliance are advised.'
    );
  }

  if (limitations) {
    bullets.push(
      `Assessment limitations: ${limitations.slice(0, 150)}${
        limitations.length > 150 ? '...' : ''
      }`
    );
  }

  let closing = '';
  if (actionCounts.P1 > 0) {
    closing = `High priority recommendations should be implemented without delay to address significant explosion risks and reduce the likelihood of dangerous substance incidents. These actions are essential to ensuring the safety of personnel and compliance with DSEAR regulations. Full details of the assessment methodology, hazardous area classification, ignition source controls, and detailed recommendations are provided in the main body of this report.`;
  } else if (totalActions > 0) {
    closing = `Implementation of the recommended actions will enhance explosion protection standards and ensure continued compliance with DSEAR regulatory requirements. Priority should be given to higher-rated recommendations to address the most significant areas for improvement. Full details of the assessment methodology, hazardous area classification, and detailed recommendations are provided in the main body of this report.`;
  } else {
    closing = `This executive summary provides an overview of the key findings. Full details of the DSEAR assessment methodology, hazardous area classification, and current explosion protection arrangements are provided in the main body of this report.`;
  }

  const bulletSection = bullets.map((b) => `• ${b}`).join('\n');
  return `${bulletSection}\n\n${closing}`;
}

function buildFsdExecutiveSummary(
  title: string,
  assessmentDate: string,
  scope: string | null,
  limitations: string | null,
  modules: ModuleOutcome[],
  actionCounts: ActionCount
): string {
  const date = new Date(assessmentDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const totalActions =
    actionCounts.P1 + actionCounts.P2 + actionCounts.P3 + actionCounts.P4;

  const compliantCount = modules.filter((m) => m.outcome === 'compliant').length;
  const minorDefCount = modules.filter((m) => m.outcome === 'minor_def').length;
  const materialDefCount = modules.filter(
    (m) => m.outcome === 'material_def'
  ).length;
  const infoGapCount = modules.filter((m) => m.outcome === 'info_gap').length;
  const totalModules = modules.length;

  const bullets: string[] = [];

  bullets.push(
    `Design Review Date: ${date}${scope ? ` for ${scope.trim()}` : ''}.`
  );

  bullets.push(
    `${totalModules} key aspect${
      totalModules !== 1 ? 's' : ''
    } of the fire strategy were reviewed to verify compliance with Building Regulations and functional requirements.`
  );

  if (materialDefCount > 0) {
    bullets.push(
      `${materialDefCount} area${
        materialDefCount > 1 ? 's' : ''
      } with material non-compliances requiring design revision were identified.`
    );
  }

  if (minorDefCount > 0) {
    bullets.push(
      `${minorDefCount} area${
        minorDefCount > 1 ? 's' : ''
      } with minor observations were found and should be addressed to ensure robust fire safety provision.`
    );
  }

  if (compliantCount === totalModules && totalModules > 0) {
    bullets.push(
      'All reviewed aspects of the fire strategy were found to be compliant with applicable Building Regulations and supporting guidance.'
    );
  }

  if (infoGapCount > 0) {
    bullets.push(
      `${infoGapCount} area${
        infoGapCount > 1 ? 's' : ''
      } where further design information or clarification is required to complete the fire strategy review.`
    );
  }

  if (totalActions > 0) {
    const actionParts: string[] = [];
    if (actionCounts.P1 > 0) {
      actionParts.push(
        `${actionCounts.P1} high priority (P1) action${actionCounts.P1 > 1 ? 's' : ''}`
      );
    }
    if (actionCounts.P2 > 0) {
      actionParts.push(
        `${actionCounts.P2} medium-high priority (P2) action${
          actionCounts.P2 > 1 ? 's' : ''
        }`
      );
    }
    if (actionCounts.P3 > 0) {
      actionParts.push(
        `${actionCounts.P3} medium priority (P3) action${actionCounts.P3 > 1 ? 's' : ''}`
      );
    }
    if (actionCounts.P4 > 0) {
      actionParts.push(
        `${actionCounts.P4} lower priority (P4) observation${
          actionCounts.P4 > 1 ? 's' : ''
        }`
      );
    }

    bullets.push(
      `${totalActions} design recommendation${
        totalActions > 1 ? 's have' : ' has'
      } been made: ${actionParts.join(', ')}.`
    );
  } else {
    bullets.push(
      'No specific design recommendations have been made at this time. The fire strategy appears to meet the applicable regulatory standards subject to detailed design development and approval.'
    );
  }

  if (limitations) {
    bullets.push(
      `Review limitations: ${limitations.slice(0, 150)}${
        limitations.length > 150 ? '...' : ''
      }`
    );
  }

  let closing = '';
  if (actionCounts.P1 > 0) {
    closing = `High priority recommendations should be addressed through design revision to ensure the building meets applicable fire safety standards and Building Regulations. These actions are essential to achieving Building Control approval and ensuring life safety objectives are met. Full details of the regulatory basis, fire strategy principles, design review findings, and detailed recommendations are provided in the main body of this report.`;
  } else if (totalActions > 0) {
    closing = `Implementation of the recommended design changes will enhance the fire strategy and ensure full compliance with Building Regulations and functional requirements. Priority should be given to higher-rated recommendations to address the most significant design issues. Full details of the regulatory basis, fire strategy principles, and detailed recommendations are provided in the main body of this report.`;
  } else {
    closing = `This executive summary provides an overview of the key findings. Full details of the regulatory basis, fire strategy principles, means of escape design, passive and active fire protection measures, and compliance review are provided in the main body of this report.`;
  }

  const bulletSection = bullets.map((b) => `• ${b}`).join('\n');
  return `${bulletSection}\n\n${closing}`;
}
