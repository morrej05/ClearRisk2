import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getModuleName } from '../../lib/modules/moduleCatalog';
import A1DocumentControlForm from './forms/A1DocumentControlForm';
import A2BuildingProfileForm from './forms/A2BuildingProfileForm';
import A3PersonsAtRiskForm from './forms/A3PersonsAtRiskForm';
import A4ManagementControlsForm from './forms/A4ManagementControlsForm';
import A5EmergencyArrangementsForm from './forms/A5EmergencyArrangementsForm';
import FRA1FireHazardsForm from './forms/FRA1FireHazardsForm';
import FRA2MeansOfEscapeForm from './forms/FRA2MeansOfEscapeForm';
import FRA3FireProtectionForm from './forms/FRA3FireProtectionForm';
import FRA4SignificantFindingsForm from './forms/FRA4SignificantFindingsForm';
import FRA5ExternalFireSpreadForm from './forms/FRA5ExternalFireSpreadForm';
import FSD1RegulatoryBasisForm from './forms/FSD1RegulatoryBasisForm';
import FSD2EvacuationStrategyForm from './forms/FSD2EvacuationStrategyForm';
import FSD3MeansOfEscapeDesignForm from './forms/FSD3MeansOfEscapeDesignForm';
import FSD4PassiveFireProtectionForm from './forms/FSD4PassiveFireProtectionForm';
import FSD5ActiveFireSystemsDesignForm from './forms/FSD5ActiveFireSystemsDesignForm';
import FSD6FireServiceAccessForm from './forms/FSD6FireServiceAccessForm';
import FSD7DrawingsIndexForm from './forms/FSD7DrawingsIndexForm';
import FSD8SmokeControlForm from './forms/FSD8SmokeControlForm';
import FSD9ConstructionPhaseFireSafetyForm from './forms/FSD9ConstructionPhaseFireSafetyForm';
import DSEAR1DangerousSubstancesForm from './forms/DSEAR1DangerousSubstancesForm';
import DSEAR2ProcessReleasesForm from './forms/DSEAR2ProcessReleasesForm';
import DSEAR3HazardousAreaClassificationForm from './forms/DSEAR3HazardousAreaClassificationForm';
import DSEAR4IgnitionSourcesForm from './forms/DSEAR4IgnitionSourcesForm';
import DSEAR5ExplosionProtectionForm from './forms/DSEAR5ExplosionProtectionForm';
import DSEAR6RiskAssessmentTableForm from './forms/DSEAR6RiskAssessmentTableForm';
import DSEAR10HierarchyControlForm from './forms/DSEAR10HierarchyControlForm';
import DSEAR11ExplosionEmergencyResponseForm from './forms/DSEAR11ExplosionEmergencyResponseForm';
import OutcomePanel from './OutcomePanel';
import ModuleActions from './ModuleActions';
// RiskEngineeringForm is deprecated - RISK_ENGINEERING now routes to RE14DraftOutputsForm (RE-11 Summary)
import RE01DocumentControlForm from './forms/RE01DocumentControlForm';
import RE02ConstructionForm from './forms/RE02ConstructionForm';
import RE03OccupancyForm from './forms/RE03OccupancyForm';
import RE06FireProtectionForm from './forms/RE06FireProtectionForm';
import RE07ExposuresForm from './forms/RE07ExposuresForm';
import RE08UtilitiesForm from './forms/RE08UtilitiesForm';
import RE09ManagementForm from './forms/RE09ManagementForm';
import RE10ProcessRiskForm from './forms/RE10ProcessRiskForm';
import RE10SitePhotosForm from './forms/RE10SitePhotosForm';
import RE12LossValuesForm from './forms/RE12LossValuesForm';
import RE09RecommendationsForm from './forms/RE09RecommendationsForm';
import RE14DraftOutputsForm from './forms/RE14DraftOutputsForm';

interface Document {
  id: string;
  document_type: string;
  title: string;
  assessment_date: string;
  assessor_name: string | null;
  assessor_role: string | null;
  responsible_person: string | null;
  scope_description: string | null;
  limitations_assumptions: string | null;
  standards_selected: string[];
}

interface ModuleInstance {
  id: string;
  module_key: string;
  outcome: string | null;
  completed_at: string | null;
  assessor_notes: string;
  data: Record<string, any>;
  updated_at: string;
}

interface ModuleRendererProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: (moduleId?: string, updatedData?: any) => void;
}

export default function ModuleRenderer({
  moduleInstance,
  document,
  onSaved,
}: ModuleRendererProps) {
  // Lifecycle instrumentation: track mount/unmount and prop changes
  useEffect(() => {
    const dataHash = JSON.stringify(moduleInstance.data || {}).substring(0, 100);
    console.log('[ModuleRenderer] MOUNT', {
      moduleKey: moduleInstance.module_key,
      moduleId: moduleInstance.id,
      documentId: document.id,
      dataPreview: dataHash,
      updatedAt: moduleInstance.updated_at,
    });

    return () => {
      console.log('[ModuleRenderer] UNMOUNT', {
        moduleKey: moduleInstance.module_key,
        moduleId: moduleInstance.id,
      });
    };
  }, []); // Empty deps = mount/unmount only

  // Track when moduleInstance changes
  useEffect(() => {
    const dataHash = JSON.stringify(moduleInstance.data || {}).substring(0, 100);
    console.log('[ModuleRenderer] PROPS CHANGE', {
      moduleKey: moduleInstance.module_key,
      moduleId: moduleInstance.id,
      dataPreview: dataHash,
      updatedAt: moduleInstance.updated_at,
    });
  }, [moduleInstance]);

  if (moduleInstance.module_key === 'A1_DOC_CONTROL') {
    return (
      <>
        <A1DocumentControlForm
          moduleInstance={moduleInstance}
          document={document}
          onSaved={onSaved}
        />
        {document?.id && moduleInstance?.id && (
          <div className="px-6 pb-6 max-w-5xl mx-auto">
            <ModuleActions
              documentId={document.id}
              moduleInstanceId={moduleInstance.id}
            />
          </div>
        )}
      </>
    );
  }

  if (moduleInstance.module_key === 'A2_BUILDING_PROFILE') {
    return (
      <A2BuildingProfileForm
        moduleInstance={moduleInstance}
        document={document}
        onSaved={onSaved}
      />
    );
  }

  if (moduleInstance.module_key === 'A3_PERSONS_AT_RISK') {
    return (
      <A3PersonsAtRiskForm
        moduleInstance={moduleInstance}
        document={document}
        onSaved={onSaved}
      />
    );
  }

  if (moduleInstance.module_key === 'A4_MANAGEMENT_CONTROLS') {
    return (
      <A4ManagementControlsForm
        moduleInstance={moduleInstance}
        document={document}
        onSaved={onSaved}
      />
    );
  }

  if (moduleInstance.module_key === 'A5_EMERGENCY_ARRANGEMENTS') {
    return (
      <A5EmergencyArrangementsForm
        moduleInstance={moduleInstance}
        document={document}
        onSaved={onSaved}
      />
    );
  }

  if (moduleInstance.module_key === 'FRA_1_HAZARDS') {
    return (
      <FRA1FireHazardsForm
        moduleInstance={moduleInstance}
        document={document}
        onSaved={onSaved}
      />
    );
  }

  if (moduleInstance.module_key === 'FRA_2_ESCAPE_ASIS') {
    return (
      <FRA2MeansOfEscapeForm
        moduleInstance={moduleInstance}
        document={document}
        onSaved={onSaved}
      />
    );
  }

  if (moduleInstance.module_key === 'FRA_3_PROTECTION_ASIS') {
    return (
      <FRA3FireProtectionForm
        moduleInstance={moduleInstance}
        document={document}
        onSaved={onSaved}
      />
    );
  }

  if (moduleInstance.module_key === 'FRA_4_SIGNIFICANT_FINDINGS') {
    return (
      <FRA4SignificantFindingsForm
        moduleInstance={moduleInstance}
        document={document}
        onSaved={onSaved}
      />
    );
  }

  if (moduleInstance.module_key === 'FRA_5_EXTERNAL_FIRE_SPREAD') {
    return (
      <FRA5ExternalFireSpreadForm
        moduleInstance={moduleInstance}
        document={document}
        onSaved={onSaved}
      />
    );
  }

  if (moduleInstance.module_key === 'FSD_1_REG_BASIS') {
    return (
      <FSD1RegulatoryBasisForm
        moduleInstance={moduleInstance}
        document={document}
        onSaved={onSaved}
      />
    );
  }

  if (moduleInstance.module_key === 'FSD_2_EVAC_STRATEGY') {
    return (
      <FSD2EvacuationStrategyForm
        moduleInstance={moduleInstance}
        document={document}
        onSaved={onSaved}
      />
    );
  }

  if (moduleInstance.module_key === 'FSD_3_ESCAPE_DESIGN') {
    return (
      <FSD3MeansOfEscapeDesignForm
        moduleInstance={moduleInstance}
        document={document}
        onSaved={onSaved}
      />
    );
  }

  if (moduleInstance.module_key === 'FSD_4_PASSIVE_PROTECTION') {
    return (
      <FSD4PassiveFireProtectionForm
        moduleInstance={moduleInstance}
        document={document}
        onSaved={onSaved}
      />
    );
  }

  if (moduleInstance.module_key === 'FSD_5_ACTIVE_SYSTEMS') {
    return (
      <FSD5ActiveFireSystemsDesignForm
        moduleInstance={moduleInstance}
        document={document}
        onSaved={onSaved}
      />
    );
  }

  if (moduleInstance.module_key === 'FSD_6_FRS_ACCESS') {
    return (
      <FSD6FireServiceAccessForm
        moduleInstance={moduleInstance}
        document={document}
        onSaved={onSaved}
      />
    );
  }

  if (moduleInstance.module_key === 'FSD_7_DRAWINGS') {
    return (
      <FSD7DrawingsIndexForm
        moduleInstance={moduleInstance}
        document={document}
        onSaved={onSaved}
      />
    );
  }

  if (moduleInstance.module_key === 'FSD_8_SMOKE_CONTROL') {
    return (
      <FSD8SmokeControlForm
        moduleInstance={moduleInstance}
        document={document}
        onSaved={onSaved}
      />
    );
  }

  if (moduleInstance.module_key === 'FSD_9_CONSTRUCTION_PHASE') {
    return (
      <FSD9ConstructionPhaseFireSafetyForm
        moduleInstance={moduleInstance}
        document={document}
        onSaved={onSaved}
      />
    );
  }

  if (moduleInstance.module_key === 'RISK_ENGINEERING') {
    // Route to RE-11 Summary & Key Findings (single authoritative summary view)
    return <RE14DraftOutputsForm moduleInstance={moduleInstance} document={document} onSaved={onSaved} />;
  }

  if (moduleInstance.module_key === 'RE_01_DOC_CONTROL') {
    return <RE01DocumentControlForm moduleInstance={moduleInstance} document={document} onSaved={onSaved} />;
  }

  if (moduleInstance.module_key === 'RE_02_CONSTRUCTION') {
    return <RE02ConstructionForm moduleInstance={moduleInstance} document={document} onSaved={onSaved} />;
  }

  if (moduleInstance.module_key === 'RE_03_OCCUPANCY') {
    return <RE03OccupancyForm moduleInstance={moduleInstance} document={document} onSaved={onSaved} />;
  }

  if (moduleInstance.module_key === 'RE_06_FIRE_PROTECTION') {
    return <RE06FireProtectionForm moduleInstance={moduleInstance} document={document} onSaved={onSaved} />;
  }

  if (moduleInstance.module_key === 'RE_07_NATURAL_HAZARDS') {
    return <RE07ExposuresForm moduleInstance={moduleInstance} document={document} onSaved={onSaved} />;
  }

  if (moduleInstance.module_key === 'RE_08_UTILITIES') {
    return <RE08UtilitiesForm moduleInstance={moduleInstance} document={document} onSaved={onSaved} />;
  }

  if (moduleInstance.module_key === 'RE_09_MANAGEMENT') {
    return <RE09ManagementForm moduleInstance={moduleInstance} document={document} onSaved={onSaved} />;
  }

  if (moduleInstance.module_key === 'RE_10_PROCESS_RISK') {
    return <RE10ProcessRiskForm moduleInstance={moduleInstance} document={document} onSaved={onSaved} />;
  }

  if (moduleInstance.module_key === 'RE_10_SITE_PHOTOS') {
    return <RE10SitePhotosForm moduleInstance={moduleInstance} document={document} onSaved={onSaved} />;
  }

  if (moduleInstance.module_key === 'RE_12_LOSS_VALUES') {
    return <RE12LossValuesForm moduleInstance={moduleInstance} document={document} onSaved={onSaved} />;
  }

  if (moduleInstance.module_key === 'RE_13_RECOMMENDATIONS') {
    return <RE09RecommendationsForm moduleInstance={moduleInstance} document={document} onSaved={onSaved} />;
  }

  if (moduleInstance.module_key === 'RE_14_DRAFT_OUTPUTS') {
    return <RE14DraftOutputsForm moduleInstance={moduleInstance} document={document} onSaved={onSaved} />;
  }

  if (moduleInstance.module_key === 'DSEAR_1_DANGEROUS_SUBSTANCES') {
    return <DSEAR1DangerousSubstancesForm moduleInstance={moduleInstance} document={document} onSaved={onSaved} />;
  }

  if (moduleInstance.module_key === 'DSEAR_2_PROCESS_RELEASES') {
    return <DSEAR2ProcessReleasesForm moduleInstance={moduleInstance} document={document} onSaved={onSaved} />;
  }

  if (moduleInstance.module_key === 'DSEAR_3_HAZARDOUS_AREA_CLASSIFICATION') {
    return <DSEAR3HazardousAreaClassificationForm moduleInstance={moduleInstance} document={document} onSaved={onSaved} />;
  }

  if (moduleInstance.module_key === 'DSEAR_4_IGNITION_SOURCES') {
    return <DSEAR4IgnitionSourcesForm moduleInstance={moduleInstance} document={document} onSaved={onSaved} />;
  }

  if (moduleInstance.module_key === 'DSEAR_5_EXPLOSION_PROTECTION') {
    return <DSEAR5ExplosionProtectionForm moduleInstance={moduleInstance} document={document} onSaved={onSaved} />;
  }

  if (moduleInstance.module_key === 'DSEAR_6_RISK_ASSESSMENT') {
    return <DSEAR6RiskAssessmentTableForm moduleInstance={moduleInstance} document={document} onSaved={onSaved} />;
  }

  if (moduleInstance.module_key === 'DSEAR_10_HIERARCHY_OF_CONTROL') {
    return <DSEAR10HierarchyControlForm moduleInstance={moduleInstance} document={document} onSaved={onSaved} />;
  }

  if (moduleInstance.module_key === 'DSEAR_11_EXPLOSION_EMERGENCY_RESPONSE') {
    return <DSEAR11ExplosionEmergencyResponseForm moduleInstance={moduleInstance} document={document} onSaved={onSaved} />;
  }

  return <PlaceholderModuleForm moduleInstance={moduleInstance} document={document} onSaved={onSaved} />;
}

function PlaceholderModuleForm({
  moduleInstance,
  document,
  onSaved,
}: ModuleRendererProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const completedAt = outcome ? new Date().toISOString() : null;

      const { error } = await supabase
        .from('module_instances')
        .update({
          outcome: outcome || null,
          assessor_notes: assessorNotes,
          completed_at: completedAt,
        })
        .eq('id', moduleInstance.id);

      if (error) throw error;

      onSaved();
    } catch (error) {
      console.error('Error saving module:', error);
      alert('Failed to save module. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">
          {getModuleName(moduleInstance.module_key)}
        </h2>
        <p className="text-neutral-600">
          Module editor coming soon
        </p>
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-6">
        <div className="flex items-start gap-4 mb-4">
          <AlertCircle className="w-6 h-6 text-blue-500 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-bold text-neutral-900 mb-2">
              Module Editor Under Construction
            </h3>
            <p className="text-neutral-600 mb-4">
              The detailed form for this module is being developed. For now, you can:
            </p>
            <ul className="list-disc list-inside space-y-1 text-neutral-600 text-sm">
              <li>Set the module outcome below</li>
              <li>Add assessor notes</li>
              <li>Create actions that need to be addressed</li>
              <li>Mark the module as complete</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-neutral-200">
          <p className="text-sm text-neutral-500">
            <strong>Module Key:</strong> {moduleInstance.module_key}
          </p>
          <p className="text-sm text-neutral-500 mt-1">
            <strong>Document Type:</strong> {document.document_type}
          </p>
        </div>
      </div>

      <OutcomePanel
        outcome={outcome}
        assessorNotes={assessorNotes}
        onOutcomeChange={setOutcome}
        onNotesChange={setAssessorNotes}
        onSave={handleSave}
        isSaving={isSaving}
      />

      {document?.id && moduleInstance?.id && (
        <ModuleActions
          documentId={document.id}
          moduleInstanceId={moduleInstance.id}
        />
      )}
    </div>
  );
}
