import { useState, useRef, useEffect } from 'react';
import { X, AlertTriangle, Upload, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { uploadAttachment } from '../../utils/evidenceManagement';
import {
  deriveSeverity,
  type FraFindingCategory,
  type FraActionInput,
  type FraContext,
} from '../../lib/modules/fra/severityEngine';
import { deriveExplosionSeverity } from '../../lib/dsear/criticalityEngine';
import { bumpActionsVersion } from '../../lib/actions/actionsInvalidation';
import { getModuleOutcomeCategory } from '../../lib/modules/moduleCatalog';

interface AddActionModalProps {
  documentId: string;
  moduleInstanceId: string;
  onClose: () => void;
  onActionCreated: () => void;
  defaultAction?: string;
  source?: 'manual' | 'info_gap' | 'recommendation' | 'system';
  sourceModuleKey?: string;
}

const TIMESCALE_OPTIONS = [
  { value: 'immediate', label: 'Immediate' },
  { value: '30d', label: '≤ 30 days' },
  { value: '90d', label: '≤ 90 days' },
  { value: 'next_review', label: 'Next Review' },
  { value: 'custom', label: 'Custom' },
];

const DSEAR_TRIGGERS = [
  { id: 'noHac', label: 'Hazardous area classification not completed / not available', category: 'HAC' },
  { id: 'zone0_20Present', label: 'Zone 0 / Zone 20 present', category: 'HAC' },
  { id: 'zone1_21Present', label: 'Zone 1 / Zone 21 present', category: 'HAC' },
  { id: 'exEquipNotConfirmed', label: 'Ex equipment suitability/certification not confirmed for zone/group/temp class', category: 'Equipment' },
  { id: 'hotWorkControlsWeak', label: 'Hot work controls inadequate for classified areas', category: 'Controls' },
  { id: 'staticBondingMissing', label: 'Bonding/earthing/static control not confirmed', category: 'Controls' },
  { id: 'ventilationInadequate', label: 'Ventilation adequacy not assessed / likely inadequate for releases', category: 'Controls' },
  { id: 'dsrIncomplete', label: 'Dangerous substances register/SDS incomplete', category: 'Management' },
  { id: 'dustHousekeeping', label: 'Combustible dust accumulation / housekeeping inadequate', category: 'Management' },
];



type FsdFindingCategory =
  | 'RegulatoryBasis'
  | 'BuildingProfileOccupancy'
  | 'FireStrategy'
  | 'EscapeDesign'
  | 'EvacuationStrategy'
  | 'PassiveFireProtection'
  | 'ActiveFireSystems'
  | 'SmokeControl'
  | 'FireRescueServiceAccess'
  | 'DrawingsSchedules'
  | 'ConstructionPhaseFireSafety'
  | 'DeviationsAlternativeApproach'
  | 'InformationGap'
  | 'Other';

type ActionCategory = FraFindingCategory | FsdFindingCategory;

const FSD_CATEGORY_OPTIONS: Array<{ value: FsdFindingCategory; label: string }> = [
  { value: 'RegulatoryBasis', label: 'Regulatory Basis' },
  { value: 'BuildingProfileOccupancy', label: 'Building Profile / Occupancy' },
  { value: 'FireStrategy', label: 'Fire Strategy' },
  { value: 'EscapeDesign', label: 'Escape Design' },
  { value: 'EvacuationStrategy', label: 'Evacuation Strategy' },
  { value: 'PassiveFireProtection', label: 'Passive Fire Protection' },
  { value: 'ActiveFireSystems', label: 'Active Fire Systems' },
  { value: 'SmokeControl', label: 'Smoke Control' },
  { value: 'FireRescueServiceAccess', label: 'Fire & Rescue Service Access' },
  { value: 'DrawingsSchedules', label: 'Drawings & Schedules' },
  { value: 'ConstructionPhaseFireSafety', label: 'Construction Phase Fire Safety' },
  { value: 'DeviationsAlternativeApproach', label: 'Deviations / Alternative Approach' },
  { value: 'InformationGap', label: 'Information Gap' },
  { value: 'Other', label: 'Other' },
];

function getDefaultFsdCategory(sourceModuleKey?: string): FsdFindingCategory {
  switch (sourceModuleKey) {
    case 'FSD_1_REG_BASIS':
      return 'RegulatoryBasis';
    case 'A2_BUILDING_PROFILE':
    case 'A3_PERSONS_AT_RISK':
      return 'BuildingProfileOccupancy';
    case 'FSD_2_EVAC_STRATEGY':
      return 'EvacuationStrategy';
    case 'FSD_3_ESCAPE_DESIGN':
      return 'EscapeDesign';
    case 'FSD_4_PASSIVE_PROTECTION':
      return 'PassiveFireProtection';
    case 'FSD_5_ACTIVE_SYSTEMS':
      return 'ActiveFireSystems';
    case 'FSD_6_FRS_ACCESS':
      return 'FireRescueServiceAccess';
    case 'FSD_7_DRAWINGS':
      return 'DrawingsSchedules';
    case 'FSD_8_SMOKE_CONTROL':
      return 'SmokeControl';
    case 'FSD_9_CONSTRUCTION_PHASE':
      return 'ConstructionPhaseFireSafety';
    default:
      return 'FireStrategy';
  }
}

function improveGenericFsdActionText(actionText: string, sourceModuleKey?: string): string {
  const normalized = actionText.trim().toLowerCase();
  const genericTexts = new Set([
    'improvement needed',
    'improvements needed',
    'improvement required',
    'action required',
  ]);

  if (!genericTexts.has(normalized)) {
    return actionText;
  }

  switch (sourceModuleKey) {
    case 'FSD_1_REG_BASIS':
      return 'Document the regulatory basis, standards, and any engineered departures applied to the design.';
    case 'FSD_2_EVAC_STRATEGY':
      return 'Define the evacuation strategy, management dependencies, and assisted evacuation assumptions for the design case.';
    case 'FSD_3_ESCAPE_DESIGN':
      return 'Complete and record means-of-escape capacity/travel distance checks against the selected design approach.';
    case 'FSD_4_PASSIVE_PROTECTION':
      return 'Define the passive fire protection strategy, including compartmentation lines, fire resistance periods, and interfaces.';
    case 'FSD_5_ACTIVE_SYSTEMS':
      return 'Specify active fire systems design intent, performance criteria, and key cause-and-effect interfaces.';
    case 'FSD_6_FRS_ACCESS':
      return 'Confirm fire and rescue service access provisions and document the supporting design assumptions.';
    case 'FSD_7_DRAWINGS':
      return 'Provide the required fire strategy drawings and schedules to support design coordination and approval.';
    case 'FSD_8_SMOKE_CONTROL':
      return 'Provide smoke control design basis, supporting calculations/drawings, and system interface requirements.';
    case 'FSD_9_CONSTRUCTION_PHASE':
      return 'Confirm temporary means of escape and construction-phase fire safety controls during works.';
    default:
      return 'Provide a clear fire safety design action with scope, basis, and deliverable evidence.';
  }
}

export default function AddActionModal({
  documentId,
  moduleInstanceId,
  onClose,
  onActionCreated,
  defaultAction = '',
  source,
  sourceModuleKey,
}: AddActionModalProps) {
  const { organisation, user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAttachmentPrompt, setShowAttachmentPrompt] = useState(false);
  const [createdActionId, setCreatedActionId] = useState<string | null>(null);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [uploadedFilesCount, setUploadedFilesCount] = useState(0);
  const [documentType, setDocumentType] = useState<string | null>(null);
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [moduleInstances, setModuleInstances] = useState<any[]>([]);
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [userEditedActionText, setUserEditedActionText] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    recommendedAction: defaultAction,
    category: 'Other' as ActionCategory,
    // FRA triggers
    finalExitLocked: false,
    finalExitObstructed: false,
    noFireDetection: false,
    detectionInadequateCoverage: false,
    noEmergencyLighting: false,
    seriousCompartmentationFailure: false,
    singleStairCompromised: false,
    highRiskRoomToEscapeRoute: false,
    noFraEvidenceOrReview: false,
    // DSEAR triggers
    noHac: false,
    zone0_20Present: false,
    zone1_21Present: false,
    exEquipNotConfirmed: false,
    hotWorkControlsWeak: false,
    staticBondingMissing: false,
    ventilationInadequate: false,
    dsrIncomplete: false,
    dustHousekeeping: false,
    // Common fields
    timescale: 'next_review',
    overrideJustification: '',
    targetDate: '',
    escalateToP1: false,
    escalationJustification: '',
  });

  // Reset edit tracking when modal opens with new props
  useEffect(() => {
    setUserEditedActionText(false);
  }, [defaultAction, documentId, moduleInstanceId]);

  useEffect(() => {
    if (documentType === 'FSD') {
      setFormData((prev) => ({ ...prev, category: getDefaultFsdCategory(sourceModuleKey) }));
    }
  }, [documentType, sourceModuleKey]);

  useEffect(() => {
    const fetchContext = async () => {
      try {
        const { data: doc, error: docError } = await supabase
          .from('documents')
          .select('document_type, enabled_modules')
          .eq('id', documentId)
          .single();

        if (docError) throw docError;
        setDocumentType(doc.document_type);
        setEnabledModules(doc.enabled_modules || [doc.document_type]);

        const { data: modules, error: modulesError } = await supabase
          .from('module_instances')
          .select('module_key, outcome, assessor_notes, data')
          .eq('document_id', documentId);

        if (modulesError) throw modulesError;
        setModuleInstances(modules || []);
      } catch (error) {
        console.error('Error fetching context:', error);
      } finally {
        setIsLoadingContext(false);
      }
    };

    fetchContext();
  }, [documentId]);

  // Build FRA context - for now, default to NonSleeping with 2 storeys
  // In a real implementation, fetch this from document/building profile
  const fraContext: FraContext = {
    occupancyRisk: 'NonSleeping',
    storeys: 2,
  };

  // Helper: Compute explosion trigger severity from state
  const computeExplosionTriggerSeverity = (): 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' | 'NONE' => {
    const hasCritical = formData.noHac || formData.zone0_20Present;
    const hasHigh = formData.zone1_21Present || formData.exEquipNotConfirmed ||
                    formData.hotWorkControlsWeak || formData.staticBondingMissing;
    const hasModerate = formData.ventilationInadequate || formData.dsrIncomplete;
    const hasLow = formData.dustHousekeeping;

    if (hasCritical) return 'CRITICAL';
    if (hasHigh) return 'HIGH';
    if (hasModerate) return 'MODERATE';
    if (hasLow) return 'LOW';
    return 'NONE';
  };

  // Helper: Build human-readable trigger text
  const buildTriggerText = (): string => {
    const fireLabels: string[] = [];
    const explosionLabels: string[] = [];

    // Collect selected FRA triggers
    const FRA_TRIGGER_MAP = [
      { key: 'finalExitLocked', label: 'Final exit locked/secured' },
      { key: 'finalExitObstructed', label: 'Final exit obstructed' },
      { key: 'noFireDetection', label: 'No fire detection system' },
      { key: 'detectionInadequateCoverage', label: 'Detection coverage inadequate' },
      { key: 'noEmergencyLighting', label: 'No emergency lighting' },
      { key: 'seriousCompartmentationFailure', label: 'Serious compartmentation failure' },
      { key: 'singleStairCompromised', label: 'Single stair compromised' },
      { key: 'highRiskRoomToEscapeRoute', label: 'High-risk room to escape route' },
      { key: 'noFraEvidenceOrReview', label: 'No FRA evidence/overdue review' },
    ];

    for (const trigger of FRA_TRIGGER_MAP) {
      if (formData[trigger.key as keyof typeof formData]) {
        fireLabels.push(trigger.label);
      }
    }

    // Collect selected DSEAR triggers
    for (const trigger of DSEAR_TRIGGERS) {
      if (formData[trigger.id as keyof typeof formData]) {
        explosionLabels.push(trigger.label);
      }
    }

    // Build combined text
    const parts: string[] = [];
    if (fireLabels.length > 0) {
      parts.push(`Fire triggers: ${fireLabels.join(', ')}`);
    }
    if (explosionLabels.length > 0) {
      parts.push(`Explosion triggers: ${explosionLabels.join(', ')}`);
    }

    return parts.join('; ');
  };

  // Build action input for severity engine
  const actionInput: FraActionInput = {
    category: (formData.category as FraFindingCategory),
    finalExitLocked: formData.finalExitLocked,
    finalExitObstructed: formData.finalExitObstructed,
    noFireDetection: formData.noFireDetection,
    detectionInadequateCoverage: formData.detectionInadequateCoverage,
    noEmergencyLighting: formData.noEmergencyLighting,
    seriousCompartmentationFailure: formData.seriousCompartmentationFailure,
    singleStairCompromised: formData.singleStairCompromised,
    highRiskRoomToEscapeRoute: formData.highRiskRoomToEscapeRoute,
    noFraEvidenceOrReview: formData.noFraEvidenceOrReview,
    assessorMarkedCritical: formData.escalateToP1,
  };

  // Derive priority from appropriate severity engine(s) - deterministic combined logic
  let priorityBand: string;
  let severityTier: string;
  let triggerId: string;
  let triggerText: string;

  // Helper: Map severity to priority band
  const severityToPriority = (severity: string): { priority: string; tier: string } => {
    switch (severity) {
      case 'CRITICAL':
        return { priority: 'P1', tier: 'T4' };
      case 'HIGH':
        return { priority: 'P2', tier: 'T3' };
      case 'MODERATE':
        return { priority: 'P3', tier: 'T2' };
      case 'LOW':
        return { priority: 'P4', tier: 'T1' };
      default:
        return { priority: 'P4', tier: 'T1' };
    }
  };

  // Helper: Compare severities and return highest
  const getHighestSeverity = (sev1: string, sev2: string): string => {
    const rank = { CRITICAL: 4, HIGH: 3, MODERATE: 2, LOW: 1, NONE: 0 };
    return (rank[sev1 as keyof typeof rank] || 0) >= (rank[sev2 as keyof typeof rank] || 0) ? sev1 : sev2;
  };

  // Determine which frameworks are enabled
  const hasFra = enabledModules.includes('FRA');
  const hasDsear = enabledModules.includes('DSEAR');

  // Compute severity from both engines if applicable
  let fraSeverity = 'NONE';
  let dsearSeverity = 'NONE';

  if (hasFra) {
    const severityResult = deriveSeverity(actionInput, fraContext);
    // Map FRA tier to severity name
    fraSeverity = severityResult.tier === 'T4' ? 'CRITICAL'
                : severityResult.tier === 'T3' ? 'HIGH'
                : severityResult.tier === 'T2' ? 'MODERATE'
                : 'LOW';
  }

  if (hasDsear) {
    dsearSeverity = computeExplosionTriggerSeverity();
  }

  // Choose final severity as highest of both
  const finalSeverity = getHighestSeverity(fraSeverity, dsearSeverity);
  const severityMapping = severityToPriority(finalSeverity);
  priorityBand = severityMapping.priority;
  severityTier = severityMapping.tier;

  // Build trigger_id and trigger_text
  const customTriggerText = buildTriggerText();

  if (customTriggerText) {
    // Use custom trigger text with selected labels
    triggerText = customTriggerText;
    // Set trigger_id based on final severity and source
    if (finalSeverity === dsearSeverity && dsearSeverity !== 'NONE') {
      triggerId = `EX-MANUAL-${finalSeverity}`;
    } else if (finalSeverity === fraSeverity && fraSeverity !== 'NONE') {
      triggerId = `FRA-MANUAL-${finalSeverity}`;
    } else {
      triggerId = `MANUAL-${finalSeverity}`;
    }
  } else {
    // No triggers selected - use defaults
    triggerId = 'MANUAL-LOW';
    triggerText = '';
  }

  // Allow manual escalation to P1 with justification
  if (formData.escalateToP1) {
    priorityBand = 'P1';
    severityTier = 'T4';
    triggerId = 'MANUAL-P1';
    triggerText = 'Manually escalated to P1 by assessor.';
  }

  // FRA-only: Apply critical module floor (P2/T3 minimum for critical modules)
  // If source module is 'critical' and derived priority is too low, clamp to P2/T3
  const isCriticalModule = sourceModuleKey && getModuleOutcomeCategory(sourceModuleKey) === 'critical';
  if (isCriticalModule && documentType === 'FRA') {
    // Floor priority: P3/P4 → P2 (don't downgrade P1)
    if (priorityBand === 'P3' || priorityBand === 'P4') {
      priorityBand = 'P2';
    }
    // Floor severity: T1/T2 → T3 (don't downgrade T4)
    if (severityTier === 'T1' || severityTier === 'T2') {
      severityTier = 'T3';
    }
  }

  const getSuggestedTimescale = (priorityBand: string): string => {
    switch (priorityBand) {
      case 'P1':
        return 'immediate';
      case 'P2':
        return '30d';
      case 'P3':
        return '90d';
      case 'P4':
        return 'next_review';
      default:
        return 'next_review';
    }
  };

  const suggestedTimescale = getSuggestedTimescale(priorityBand);
  const isTimescaleOverride = formData.timescale !== suggestedTimescale;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'P1':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'P2':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'P3':
        return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'P4':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      default:
        return 'bg-neutral-100 text-neutral-600 border-neutral-300';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!organisation?.id || !user?.id) {
      alert('User or organisation not found. Please refresh and try again.');
      return;
    }

    if (!formData.recommendedAction.trim()) {
      alert('Please enter a recommended action.');
      return;
    }

    if (formData.escalateToP1 && !formData.escalationJustification.trim()) {
      alert('Please provide a justification for escalating this action to P1.');
      return;
    }

    if (isTimescaleOverride && !formData.overrideJustification.trim()) {
      alert('Please provide a justification for overriding the suggested timescale.');
      return;
    }

    setIsSubmitting(true);

    try {
      const normalizedActionText = (documentType === 'FSD'
        ? improveGenericFsdActionText(formData.recommendedAction, sourceModuleKey)
        : formData.recommendedAction).trim();
      const trimmedAction = normalizedActionText.toLowerCase();

      const { data: existingActions, error: checkError } = await supabase
        .from('actions')
        .select('id, recommended_action')
        .eq('document_id', documentId)
        .eq('module_instance_id', moduleInstanceId)
        .is('deleted_at', null);

      if (checkError) throw checkError;

      const duplicate = existingActions?.find(
        (action) => action.recommended_action.trim().toLowerCase() === trimmedAction
      );

      if (duplicate) {
        setIsSubmitting(false);
        alert('This action already exists in this module.');
        return;
      }
      let targetDate = null;
      if (formData.targetDate) {
        targetDate = formData.targetDate;
      } else {
        const today = new Date();
        switch (formData.timescale) {
          case 'immediate':
            targetDate = today.toISOString().split('T')[0];
            break;
          case '30d':
            targetDate = new Date(today.setDate(today.getDate() + 30))
              .toISOString()
              .split('T')[0];
            break;
          case '90d':
            targetDate = new Date(today.setDate(today.getDate() + 90))
              .toISOString()
              .split('T')[0];
            break;
          case 'next_review':
          case 'custom':
          default:
            targetDate = null;
        }
      }

      // Resolve source based on whether user edited the text
      const resolvedSource: 'manual' | 'library' | 'system' | 'ai' =
        source === 'library' || source === 'ai'
          ? source
          : source === 'system' || source === 'info_gap' || source === 'recommendation'
            ? 'system'
            : userEditedActionText
              ? 'manual'
              : defaultAction.trim()
                ? 'system'
                : 'manual';

      const actionData = {
        organisation_id: organisation.id,
        document_id: documentId,
        source_document_id: documentId,
        module_instance_id: moduleInstanceId,
        recommended_action: normalizedActionText,
        status: 'open',
        priority_band: priorityBand,
        severity_tier: severityTier,
        trigger_id: triggerId,
        trigger_text: triggerText,
        finding_category: formData.category,
        timescale: formData.timescale,
        target_date: targetDate,
        override_justification: isTimescaleOverride
          ? formData.overrideJustification.trim()
          : null,
        escalation_justification: formData.escalateToP1
          ? formData.escalationJustification.trim()
          : null,
        source: resolvedSource,
      };

      const { data: action, error: actionError } = await supabase
        .from('actions')
        .insert([actionData])
        .select()
        .single();

      if (actionError) throw actionError;

      bumpActionsVersion();
      setCreatedActionId(action.id);
      setShowAttachmentPrompt(true);
      // DO NOT call onActionCreated() here - it will be called when user finishes with attachments
    } catch (error) {
      console.error('Error creating action:', error);
      alert('Failed to create action. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAttachmentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !organisation?.id || !createdActionId) return;

    setIsUploadingAttachments(true);
    try {
      // Fetch document to get base_document_id
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .select('base_document_id')
        .eq('id', documentId)
        .single();

      if (docError || !docData) {
        throw new Error('Failed to fetch document information');
      }

      // Upload files using the clean uploader (no organisations quota update)
      let successCount = 0;
      for (const file of Array.from(files)) {
        const result = await uploadAttachment(
          organisation.id,
          documentId,
          docData.base_document_id,
          file,
          undefined, // caption
          moduleInstanceId,
          createdActionId
        );

        if (result.success) {
          successCount++;
        } else {
          console.error('Upload failed:', result.error);
          throw new Error(result.error || 'Upload failed');
        }
      }

      setUploadedFilesCount(prev => prev + successCount);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      alert(`${successCount} file(s) attached successfully!`);
    } catch (error) {
      console.error('Error uploading attachments:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to upload attachments: ${errorMessage}`);
    } finally {
      setIsUploadingAttachments(false);
    }
  };

  const handleFinish = () => {
    onActionCreated();
    onClose();
  };

  if (showAttachmentPrompt) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="bg-green-50 border-b border-green-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-bold text-green-900">Action Created!</h2>
            </div>
          </div>

          <div className="p-6">
            <p className="text-neutral-700 mb-4">
              Would you like to attach evidence or photos to this action?
            </p>

            {uploadedFilesCount > 0 && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800 font-medium">
                  {uploadedFilesCount} file{uploadedFilesCount !== 1 ? 's' : ''} attached successfully
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
              onChange={handleAttachmentUpload}
              className="hidden"
            />

            <div className="space-y-3">
              {uploadedFilesCount > 0 ? (
                <>
                  <button
                    onClick={handleFinish}
                    disabled={isUploadingAttachments}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-neutral-900 text-white rounded-lg hover:bg-neutral-700 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Done
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAttachments}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    {isUploadingAttachments ? 'Uploading...' : 'Attach More Files'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAttachments}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-neutral-900 text-white rounded-lg hover:bg-neutral-700 transition-colors disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    {isUploadingAttachments ? 'Uploading...' : 'Attach Files'}
                  </button>

                  <button
                    onClick={handleFinish}
                    disabled={isUploadingAttachments}
                    className="w-full px-4 py-3 border-2 border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-50"
                  >
                    Skip for Now
                  </button>
                </>
              )}
            </div>

            <p className="text-xs text-neutral-500 mt-4 text-center">
              You can also attach files later from the Evidence tab
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoadingContext) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900"></div>
            <p className="text-neutral-600">Loading context...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-neutral-900">Add Action</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Recommended Action <span className="text-red-600">*</span>
            </label>
            <textarea
              value={formData.recommendedAction}
              onChange={(e) => {
                setFormData({ ...formData, recommendedAction: e.target.value });
                setUserEditedActionText(true);
              }}
              placeholder="Describe the recommended action to address the identified deficiency or risk..."
              rows={4}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Finding Category <span className="text-red-600">*</span>
            </label>
            <select
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value as ActionCategory })
              }
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              required
            >
              {documentType === 'FSD' ? (
                FSD_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))
              ) : (
                <>
                  <option value="MeansOfEscape">Means of Escape</option>
                  <option value="DetectionAlarm">Detection & Alarm</option>
                  <option value="EmergencyLighting">Emergency Lighting</option>
                  <option value="Compartmentation">Compartmentation</option>
                  <option value="FireDoors">Fire Doors</option>
                  <option value="FireFighting">Fire Fighting Equipment</option>
                  <option value="Management">Management & Procedures</option>
                  <option value="Housekeeping">Housekeeping</option>
                  <option value="Other">Other</option>
                </>
              )}
            </select>
          </div>

          {documentType !== 'FSD' && (
          <div className="border border-neutral-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-neutral-700 mb-3">
              Critical Triggers (check if applicable)
            </label>
            <div className="space-y-2">
              {/* Show FRA triggers if FRA is enabled */}
              {hasFra && (
                <>
                  {hasDsear && (
                    <div className="text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2 mt-2">
                      Fire Safety Triggers
                    </div>
                  )}
                  {/* FRA Triggers */}
                  {(formData.category === 'MeansOfEscape' || formData.category === 'Other') && (
                    <>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.finalExitLocked}
                          onChange={(e) => setFormData({ ...formData, finalExitLocked: e.target.checked })}
                          className="mt-1"
                        />
                        <span className="text-sm text-neutral-700">Final exit locked / secured</span>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.finalExitObstructed}
                          onChange={(e) => setFormData({ ...formData, finalExitObstructed: e.target.checked })}
                          className="mt-1"
                        />
                        <span className="text-sm text-neutral-700">Final exit obstructed</span>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.singleStairCompromised}
                          onChange={(e) => setFormData({ ...formData, singleStairCompromised: e.target.checked })}
                          className="mt-1"
                        />
                        <span className="text-sm text-neutral-700">Single stair compromised (multi-storey)</span>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.highRiskRoomToEscapeRoute}
                          onChange={(e) => setFormData({ ...formData, highRiskRoomToEscapeRoute: e.target.checked })}
                          className="mt-1"
                        />
                        <span className="text-sm text-neutral-700">High-risk room opens onto escape route</span>
                      </label>
                    </>
                  )}
                  {(formData.category === 'DetectionAlarm' || formData.category === 'Other') && (
                    <>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.noFireDetection}
                          onChange={(e) => setFormData({ ...formData, noFireDetection: e.target.checked })}
                          className="mt-1"
                        />
                        <span className="text-sm text-neutral-700">No fire detection system present</span>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.detectionInadequateCoverage}
                          onChange={(e) => setFormData({ ...formData, detectionInadequateCoverage: e.target.checked })}
                          className="mt-1"
                        />
                        <span className="text-sm text-neutral-700">Detection coverage inadequate</span>
                      </label>
                    </>
                  )}
                  {(formData.category === 'EmergencyLighting' || formData.category === 'Other') && (
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.noEmergencyLighting}
                        onChange={(e) => setFormData({ ...formData, noEmergencyLighting: e.target.checked })}
                        className="mt-1"
                      />
                      <span className="text-sm text-neutral-700">No emergency lighting present (multi-storey)</span>
                    </label>
                  )}
                  {(formData.category === 'Compartmentation' || formData.category === 'Other') && (
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.seriousCompartmentationFailure}
                        onChange={(e) => setFormData({ ...formData, seriousCompartmentationFailure: e.target.checked })}
                        className="mt-1"
                      />
                      <span className="text-sm text-neutral-700">Serious compartmentation failure</span>
                    </label>
                  )}
                  {(formData.category === 'Management' || formData.category === 'Other') && (
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.noFraEvidenceOrReview}
                        onChange={(e) => setFormData({ ...formData, noFraEvidenceOrReview: e.target.checked })}
                        className="mt-1"
                      />
                      <span className="text-sm text-neutral-700">No FRA evidence / overdue review</span>
                    </label>
                  )}
                </>
              )}

              {/* Show DSEAR triggers if DSEAR is enabled */}
              {hasDsear && (
                <>
                  {hasFra && (
                    <div className="text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2 mt-4">
                      Explosion Hazard Triggers
                    </div>
                  )}
                  {/* DSEAR Triggers */}
                  {DSEAR_TRIGGERS.map((trigger) => (
                    <label key={trigger.id} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData[trigger.id as keyof typeof formData] as boolean}
                        onChange={(e) => setFormData({ ...formData, [trigger.id]: e.target.checked })}
                        className="mt-1"
                      />
                      <span className="text-sm text-neutral-700">{trigger.label}</span>
                    </label>
                  ))}
                </>
              )}
            </div>
          </div>
          )}

          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-neutral-700">Computed Severity:</span>
              <span className="text-lg font-bold text-neutral-900">{severityTier}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-700">Priority Band:</span>
              <span
                className={`inline-flex px-3 py-1 text-sm font-bold rounded border ${getPriorityColor(
                  priorityBand
                )}`}
              >
                {priorityBand}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              T4 → P1 (Material Life Safety Risk) • T3 → P2 (Significant Deficiency) • T2 → P3 (Improvement Required) • T1 → P4 (Minor)
            </p>
          </div>

          {priorityBand !== 'P1' && (
            <div className="border border-neutral-200 rounded-lg p-4 bg-neutral-50">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.escalateToP1}
                  onChange={(e) => setFormData({ ...formData, escalateToP1: e.target.checked })}
                  className="mt-1"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-neutral-700">Escalate to P1 (requires justification)</span>
                  {formData.escalateToP1 && (
                    <textarea
                      value={formData.escalationJustification}
                      onChange={(e) => setFormData({ ...formData, escalationJustification: e.target.value })}
                      placeholder="Explain why this action should be escalated to P1..."
                      rows={2}
                      className="w-full mt-2 px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none text-sm"
                      required={formData.escalateToP1}
                    />
                  )}
                </div>
              </label>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Timescale <span className="text-red-600">*</span>
            </label>
            <select
              value={formData.timescale}
              onChange={(e) =>
                setFormData({ ...formData, timescale: e.target.value })
              }
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              required
            >
              {TIMESCALE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                  {option.value === suggestedTimescale && ' (suggested)'}
                </option>
              ))}
            </select>
            {isTimescaleOverride && (
              <div className="mt-2 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  You've selected a different timescale than suggested for {priorityBand}.
                  Please provide a justification below.
                </p>
              </div>
            )}
          </div>

          {isTimescaleOverride && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Override Justification <span className="text-red-600">*</span>
              </label>
              <textarea
                value={formData.overrideJustification}
                onChange={(e) =>
                  setFormData({ ...formData, overrideJustification: e.target.value })
                }
                placeholder="Explain why this timescale is more appropriate than the suggested timescale..."
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Target Date (Optional)
            </label>
            <input
              type="date"
              value={formData.targetDate}
              onChange={(e) =>
                setFormData({ ...formData, targetDate: e.target.value })
              }
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
            />
            <p className="text-xs text-neutral-500 mt-1">
              Leave blank to auto-calculate based on timescale
            </p>
          </div>

          <div className="flex items-center gap-3 justify-end pt-4 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.recommendedAction.trim()}
              className={`px-5 py-2.5 rounded-lg font-medium transition-colors ${
                isSubmitting || !formData.recommendedAction.trim()
                  ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                  : 'bg-neutral-900 text-white hover:bg-neutral-800'
              }`}
            >
              {isSubmitting ? 'Creating...' : 'Create Action'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
