import { supabase } from '../supabase';
import { canGenerateAiSummary } from '../../utils/entitlements';

interface GenerateExecutiveSummaryOptions {
  documentId: string;
  organisationId: string;
}

interface ModuleOutcome {
  module_key: string;
  outcome: string | null;
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
        error: 'AI executive summaries are available on the Professional plan. Upgrade to access this feature.',
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
      .select('module_key, outcome')
      .eq('document_id', documentId);

    if (modulesError) {
      return { success: false, error: 'Failed to fetch module data' };
    }

    const { data: actions, error: actionsError } = await supabase
      .from('actions')
      .select('priority')
      .eq('document_id', documentId)
      .eq('status', 'open')
      .is('deleted_at', null);

    if (actionsError) {
      return { success: false, error: 'Failed to fetch action data' };
    }

    const moduleOutcomes = (modules || []) as ModuleOutcome[];

    const actionCounts: ActionCount = { P1: 0, P2: 0, P3: 0, P4: 0 };
    (actions || []).forEach((action: any) => {
      if (action.priority in actionCounts) {
        actionCounts[action.priority as keyof ActionCount]++;
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
    return buildFraExecutiveSummary(title, assessmentDate, scope, limitations, modules, actionCounts);
  }
}

function buildFraExecutiveSummary(
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
    `Assessment Date: ${date}${scope ? ` covering ${scope.toLowerCase()}` : ''}.`
  );

  bullets.push(
    `${totalModules} key area${
      totalModules !== 1 ? 's' : ''
    } of fire safety were examined to identify hazards, evaluate controls, and determine necessary actions.`
  );

  if (materialDefCount > 0) {
    bullets.push(
      `${materialDefCount} area${
        materialDefCount > 1 ? 's' : ''
      } with material deficiencies requiring immediate attention were identified.`
    );
  }

  if (minorDefCount > 0) {
    bullets.push(
      `${minorDefCount} area${
        minorDefCount > 1 ? 's' : ''
      } with minor deficiencies were found.`
    );
  }

  if (compliantCount === totalModules && totalModules > 0) {
    bullets.push(
      'All assessed areas were found to be compliant with current fire safety standards and regulations.'
    );
  }

  if (infoGapCount > 0) {
    bullets.push(
      `${infoGapCount} area${
        infoGapCount > 1 ? 's' : ''
      } where further information is required to complete the assessment.`
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
      'No specific recommendations have been made at this time. Continued maintenance of existing fire safety measures and regular review of arrangements are advised.'
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
    closing = `High priority recommendations should be implemented without delay to address significant fire safety concerns and reduce risk to acceptable levels. These actions are essential to ensuring the safety of occupants and compliance with fire safety legislation. Full details of the assessment methodology, specific findings, and detailed recommendations are provided in the main body of this report.`;
  } else if (totalActions > 0) {
    closing = `Implementation of the recommended actions will enhance fire safety standards and ensure continued compliance with regulatory requirements. Priority should be given to higher-rated recommendations to address the most significant areas for improvement. Full details of the assessment methodology, specific findings, and detailed recommendations are provided in the main body of this report.`;
  } else {
    closing = `This executive summary provides an overview of the key findings. Full details of the assessment methodology and current fire safety arrangements are provided in the main body of this report.`;
  }

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
    `Assessment Date: ${date}${scope ? ` covering ${scope.toLowerCase()}` : ''}.`
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
    `Design Review Date: ${date}${scope ? ` for ${scope.toLowerCase()}` : ''}.`
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
