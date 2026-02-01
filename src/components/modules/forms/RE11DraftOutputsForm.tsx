import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import { FileText, RefreshCw, Save, AlertCircle } from 'lucide-react';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';
import AutoExpandTextarea from '../../AutoExpandTextarea';

interface Document {
  id: string;
  title: string;
}

interface ModuleInstance {
  id: string;
  document_id: string;
  outcome: string | null;
  assessor_notes: string;
  data: Record<string, any>;
}

interface RE11DraftOutputsFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface SurveySection {
  heading: string;
  content: string;
  source_module?: string;
}

interface Recommendation {
  id: string;
  title: string;
  detail: string;
  priority: string;
  target_date: string;
  owner: string;
  status: string;
  related_section: string;
}

export default function RE11DraftOutputsForm({
  moduleInstance,
  document,
  onSaved,
}: RE11DraftOutputsFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'survey' | 'loss_prevention'>('survey');
  const d = moduleInstance.data || {};

  const defaultSurveySections: SurveySection[] = [
    { heading: 'Introduction', content: '' },
    { heading: 'Construction', content: '', source_module: 'RE02_CONSTRUCTION' },
    { heading: 'Occupancy & Hazards', content: '', source_module: 'RE03_OCCUPANCY' },
    { heading: 'Fire Protection Systems', content: '', source_module: 'RE06_FIRE_PROTECTION' },
    { heading: 'Utilities & Services', content: '', source_module: 'RE08_UTILITIES' },
    { heading: 'Loss Values', content: '', source_module: 'RE12_LOSS_VALUES' },
    { heading: 'Conclusion', content: '' },
  ];

  const safeSurveySections = Array.isArray(d.draft_survey_report?.sections)
    ? d.draft_survey_report.sections
    : defaultSurveySections;

  const [surveySections, setSurveySections] = useState<SurveySection[]>(safeSurveySections);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [lossPrevIntro, setLossPrevIntro] = useState(
    d.draft_loss_prevention_report?.introduction || ''
  );

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  useEffect(() => {
    loadRecommendations();
    if (surveySections.every((s) => !s.content)) {
      autoPopulateSurveyReport();
    }
  }, []);

  const loadRecommendations = async () => {
    try {
      const { data: recModule, error } = await supabase
        .from('module_instances')
        .select('data')
        .eq('document_id', moduleInstance.document_id)
        .eq('module_key', 'RE09_RECOMMENDATIONS')
        .single();

      if (error) throw error;

      if (recModule?.data?.recommendations) {
        setRecommendations(recModule.data.recommendations);
      }
    } catch (err) {
      console.error('Error loading recommendations:', err);
    }
  };

  const autoPopulateSurveyReport = async () => {
    setLoading(true);
    try {
      const { data: modules, error } = await supabase
        .from('module_instances')
        .select('module_key, data')
        .eq('document_id', moduleInstance.document_id);

      if (error) throw error;

      const updatedSections = surveySections.map((section) => {
        if (!section.source_module) return section;

        const sourceModule = modules.find((m) => m.module_key === section.source_module);
        if (!sourceModule) return section;

        let generatedContent = '';

        switch (section.source_module) {
          case 'RE02_CONSTRUCTION':
            generatedContent = generateConstructionContent(sourceModule.data);
            break;
          case 'RE03_OCCUPANCY':
            generatedContent = generateOccupancyContent(sourceModule.data);
            break;
          case 'RE06_FIRE_PROTECTION':
            generatedContent = generateFireProtectionContent(sourceModule.data);
            break;
          case 'RE08_UTILITIES':
            generatedContent = generateUtilitiesContent(sourceModule.data);
            break;
          case 'RE12_LOSS_VALUES':
            generatedContent = generateLossValuesContent(sourceModule.data);
            break;
        }

        return { ...section, content: generatedContent };
      });

      setSurveySections(updatedSections);
    } catch (err) {
      console.error('Error auto-populating survey:', err);
      alert('Failed to auto-populate survey. Please check module data.');
    } finally {
      setLoading(false);
    }
  };

  const generateConstructionContent = (data: any): string => {
    const construction = data?.construction;
    if (!construction) return 'No construction data available.';

    const buildings = construction.buildings || [];
    let content = `The site comprises ${buildings.length} building(s).\n\n`;

    buildings.forEach((b: any, idx: number) => {
      content += `Building ${idx + 1} (${b.building_name || 'Unnamed'}): `;
      content += `${b.num_floors || 0} floor(s), ${b.num_basements || 0} basement(s), `;
      content += `height ${b.height_m || 0}m. `;
      content += `Roof: ${b.roof_ceiling_material || 'not specified'}. `;
      content += `Combustibility: ${b.combustibility_band || 'unknown'} (${b.combustibility_score || 0}%). `;
      content += `Frame: ${b.frame_type || 'not specified'} (${b.frame_protected || 'not specified'}). `;
      if (b.cladding_panels_present) {
        content += `Cladding present: ${b.cladding_panels_details}. `;
      }
      content += `\n`;
    });

    content += `\nSite construction rating: ${construction.site_rating_1_to_5}/5.`;
    return content;
  };

  const generateOccupancyContent = (data: any): string => {
    return 'Occupancy details to be documented based on site observations.';
  };

  const generateFireProtectionContent = (data: any): string => {
    const fp = data?.fire_protection;
    if (!fp) return 'No fire protection data available.';

    let content = '';

    if (fp.systems?.sprinklers?.present) {
      content += `Sprinkler system present: ${fp.systems.sprinklers.type || 'type not specified'}. `;
      content += `Design basis: ${fp.systems.sprinklers.design_basis || 'not specified'}.\n`;
    } else {
      content += 'No sprinkler system present.\n';
    }

    if (fp.systems?.detection_alarm?.present) {
      content += `Fire detection system present. `;
      if (fp.systems.detection_alarm.monitoring_to_arc) {
        content += `Monitored to ARC. `;
      }
      content += `\n`;
    }

    if (fp.systems?.water_supply?.reliability) {
      content += `Water supply: ${fp.systems.water_supply.reliability}. `;
      content += `Primary source: ${fp.systems.water_supply.primary_source || 'not specified'}.\n`;
    }

    content += `\nFire protection site rating: ${fp.site_rating_1_to_5}/5.\n`;

    if (fp.credible_to_reduce_nle?.credible) {
      content += `\nFire protection is considered credible to materially reduce NLE. ${fp.credible_to_reduce_nle.basis || ''}`;
    } else {
      content += `\nFire protection is not considered credible to materially reduce NLE. ${fp.credible_to_reduce_nle?.basis || ''}`;
    }

    return content;
  };

  const generateUtilitiesContent = (data: any): string => {
    return 'Utilities and services details to be documented.';
  };

  const generateLossValuesContent = (data: any): string => {
    const lv = data?.loss_values;
    if (!lv) return 'No loss values data available.';

    const currency = lv.currency || 'GBP';
    const symbols: Record<string, string> = { GBP: '£', USD: '$', EUR: '€', AUD: 'A$', CAD: 'C$' };
    const symbol = symbols[currency] || '';

    let content = `Currency: ${currency}\n\n`;

    if (lv.property_sums_insured?.total) {
      content += `Property Sums Insured: ${symbol}${lv.property_sums_insured.total.toLocaleString()}\n`;
    }

    if (lv.business_interruption?.gross_profit) {
      content += `Business Interruption Gross Profit: ${symbol}${lv.business_interruption.gross_profit.toLocaleString()} (${lv.business_interruption.indemnity_period_months || 0} months)\n`;
    }

    content += `\nWorst-Case Loss Expectancy (WLE):\n`;
    content += `${lv.wle?.scenario_description || 'No scenario described'}\n`;
    if (lv.wle?.total_wle) {
      content += `Total WLE: ${symbol}${lv.wle.total_wle.toLocaleString()}\n`;
    }

    content += `\nNormal Loss Expectancy (NLE):\n`;
    content += `${lv.nle?.scenario_description || 'No scenario described'}\n`;
    if (lv.nle?.total_nle) {
      content += `Total NLE: ${symbol}${lv.nle.total_nle.toLocaleString()}\n`;
    }

    if (lv.wle?.total_wle && lv.nle?.total_nle) {
      const ratio = Math.round((lv.nle.total_nle / lv.wle.total_wle) * 100);
      content += `NLE as % of WLE: ${ratio}%`;
    }

    return content;
  };

  const updateSectionContent = (heading: string, content: string) => {
    setSurveySections(
      surveySections.map((s) => (s.heading === heading ? { ...s, content } : s))
    );
  };

  const groupRecommendationsByPriorityAndSection = () => {
    const grouped: Record<
      string,
      Record<string, Recommendation[]>
    > = {
      High: {},
      Medium: {},
      Low: {},
    };

    recommendations.forEach((rec) => {
      const priority = rec.priority || 'Medium';
      const section = rec.related_section || 'Other';

      if (!grouped[priority][section]) {
        grouped[priority][section] = [];
      }

      grouped[priority][section].push(rec);
    });

    return grouped;
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const completedAt = outcome ? new Date().toISOString() : null;
      const sanitized = sanitizeModuleInstancePayload({
        data: {
          draft_survey_report: { sections: surveySections },
          draft_loss_prevention_report: {
            introduction: lossPrevIntro,
            grouped_recommendations: groupRecommendationsByPriorityAndSection(),
          },
        },
      });

      const { error } = await supabase
        .from('module_instances')
        .update({
          data: sanitized.data,
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

  const groupedRecs = groupRecommendationsByPriorityAndSection();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-11 - Draft Outputs</h2>
        <p className="text-slate-600">
          Draft reports auto-populated from assessment data with manual editing capability
        </p>
      </div>

      <div className="mb-6">
        <div className="border-b border-slate-200">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab('survey')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'survey'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Draft Survey Report
            </button>
            <button
              onClick={() => setActiveTab('loss_prevention')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'loss_prevention'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Draft Loss Prevention Report
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'survey' && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">Draft Survey Report</p>
                  <p className="text-blue-800">
                    Structured sections auto-populated from assessment modules. Edit content as
                    needed before finalizing.
                  </p>
                </div>
              </div>
              <button
                onClick={autoPopulateSurveyReport}
                disabled={loading}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Loading...' : 'Refresh from Modules'}
              </button>
            </div>
          </div>

          {surveySections.map((section) => (
            <div key={section.heading} className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                {section.heading}
                {section.source_module && (
                  <span className="ml-2 text-xs text-slate-500 font-normal">
                    (from {section.source_module})
                  </span>
                )}
              </h3>
              <AutoExpandTextarea
                value={section.content}
                onChange={(e) => updateSectionContent(section.heading, e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm min-h-[120px]"
                placeholder={`Enter content for ${section.heading}...`}
              />
            </div>
          ))}
        </div>
      )}

      {activeTab === 'loss_prevention' && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">Draft Loss Prevention Report</p>
                <p className="text-blue-800">
                  Recommendation-driven report grouped by priority and section. Based on
                  recommendations from RE-09.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Introduction</h3>
            <AutoExpandTextarea
              value={lossPrevIntro}
              onChange={(e) => setLossPrevIntro(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm min-h-[120px]"
              placeholder="Enter introduction for the loss prevention report..."
            />
          </div>

          {recommendations.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
              <p className="text-amber-900 font-medium">No recommendations available</p>
              <p className="text-amber-700 text-sm mt-1">
                Complete RE-09 Recommendations module first to populate this report.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {['High', 'Medium', 'Low'].map((priority) => {
                const sections = groupedRecs[priority];
                const sectionKeys = Object.keys(sections);
                if (sectionKeys.length === 0) return null;

                return (
                  <div key={priority} className="bg-white rounded-lg border border-slate-200 p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">
                      {priority} Priority Recommendations
                    </h3>
                    <div className="space-y-4">
                      {sectionKeys.map((section) => {
                        const recs = sections[section];
                        return (
                          <div key={section} className="border-l-4 border-slate-300 pl-4">
                            <h4 className="font-semibold text-slate-700 mb-2">{section}</h4>
                            <ul className="space-y-3">
                              {recs.map((rec, idx) => (
                                <li key={rec.id} className="text-sm text-slate-600">
                                  <div className="font-medium text-slate-900">{rec.title}</div>
                                  <div className="mt-1">{rec.detail}</div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    Target: {rec.target_date || 'Not set'} | Owner:{' '}
                                    {rec.owner || 'Unassigned'} | Status: {rec.status}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <OutcomePanel
        outcome={outcome}
        assessorNotes={assessorNotes}
        onOutcomeChange={setOutcome}
        onNotesChange={setAssessorNotes}
        onSave={handleSave}
        isSaving={isSaving}
      />

      {document?.id && moduleInstance?.id && (
        <ModuleActions documentId={document.id} moduleInstanceId={moduleInstance.id} />
      )}
    </div>
  );
}
