import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { AlertCircle, TrendingUp, FileText, Image as ImageIcon, Save, Sparkles, Copy, ArrowRight } from 'lucide-react';
import ModuleActions from '../ModuleActions';
import FloatingSaveBar from './FloatingSaveBar';
import { buildRiskEngineeringScoreBreakdown, type ScoreFactor } from '../../../lib/re/scoring/riskEngineeringHelpers';
import AutoExpandTextarea from '../../AutoExpandTextarea';
import { generateRiskEngineeringSummary } from '../../../lib/ai/generateReSummary';

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

interface RE14DraftOutputsFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface RecommendationSummary {
  total: number;
  byPriority: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  highPriorityItems: Array<{ text: string; priority: string }>;
}

export default function RE14DraftOutputsForm({
  moduleInstance,
  document,
  onSaved,
}: RE14DraftOutputsFormProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [executiveSummary, setExecutiveSummary] = useState('');
  const [executiveSummaryAi, setExecutiveSummaryAi] = useState('');
  const [industryKey, setIndustryKey] = useState<string | null>(null);
  const [industryLabel, setIndustryLabel] = useState('No Industry Selected');
  const [siteMetadata, setSiteMetadata] = useState<any>(null);
  const [globalPillars, setGlobalPillars] = useState<ScoreFactor[]>([]);
  const [occupancyDrivers, setOccupancyDrivers] = useState<ScoreFactor[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [maxScore, setMaxScore] = useState(0);
  const [topContributors, setTopContributors] = useState<ScoreFactor[]>([]);
  const [recSummary, setRecSummary] = useState<RecommendationSummary>({
    total: 0,
    byPriority: { critical: 0, high: 0, medium: 0, low: 0 },
    highPriorityItems: [],
  });
  const [hasPhotos, setHasPhotos] = useState(false);
  const [hasSitePlan, setHasSitePlan] = useState(false);
  const [occupancyMissing, setOccupancyMissing] = useState(false);

  useEffect(() => {
    setExecutiveSummary(moduleInstance.data?.executive_summary || '');
    setExecutiveSummaryAi(moduleInstance.data?.executive_summary_ai || '');
  }, [moduleInstance]);

  useEffect(() => {
    async function loadSummaryData() {
      setLoading(true);
      try {
        const { data: modules, error } = await supabase
          .from('module_instances')
          .select('module_key, data')
          .eq('document_id', moduleInstance.document_id)
          .in('module_key', ['RE_01_DOCUMENT_CONTROL', 'RISK_ENGINEERING', 'RE_13_RECOMMENDATIONS', 'RE_10_SITE_PHOTOS']);

        if (error) throw error;

        const re01 = modules.find(m => m.module_key === 'RE_01_DOCUMENT_CONTROL');
        const riskEng = modules.find(m => m.module_key === 'RISK_ENGINEERING');
        const recommendations = modules.find(m => m.module_key === 'RE_13_RECOMMENDATIONS');
        const sitePhotos = modules.find(m => m.module_key === 'RE_10_SITE_PHOTOS');

        if (re01?.data) {
          setSiteMetadata({
            site_name: re01.data.site_name || 'Not specified',
            site_address: re01.data.site_address || 'Not specified',
            assessor_name: re01.data.assessor_name || 'Not specified',
            assessment_date: re01.data.assessment_date || 'Not specified',
          });
        }

        if (riskEng?.data) {
          // Use canonical scoring builder (single source of truth)
          const breakdown = await buildRiskEngineeringScoreBreakdown(
            moduleInstance.document_id,
            riskEng.data
          );

          console.log('[RE-11] industryKey', breakdown.industryKey);
          console.log('[RE-11] globalPillars len', breakdown.globalPillars.length);
          console.log('[RE-11] occupancyDrivers len', breakdown.occupancyDrivers.length);
          setIndustryKey(breakdown.industryKey);
          setIndustryLabel(breakdown.industryLabel);
          setOccupancyMissing(!breakdown.industryKey);
          setGlobalPillars(breakdown.globalPillars);
          setOccupancyDrivers(breakdown.occupancyDrivers);
          setTotalScore(breakdown.totalScore);
          setMaxScore(breakdown.maxScore);
          setTopContributors(breakdown.topContributors);
        }

        if (recommendations?.data?.recommendations) {
          const recs = recommendations.data.recommendations;
          const summary: RecommendationSummary = {
            total: recs.length,
            byPriority: {
              critical: recs.filter((r: any) => r.priority === 'critical').length,
              high: recs.filter((r: any) => r.priority === 'high').length,
              medium: recs.filter((r: any) => r.priority === 'medium').length,
              low: recs.filter((r: any) => r.priority === 'low').length,
            },
            highPriorityItems: recs
              .filter((r: any) => r.priority === 'high' || r.priority === 'critical')
              .map((r: any) => ({ text: r.text, priority: r.priority })),
          };
          setRecSummary(summary);
        }

        if (sitePhotos?.data) {
          setHasPhotos((sitePhotos.data.photos || []).length > 0);
          setHasSitePlan(!!sitePhotos.data.site_plan);
        }
      } catch (error) {
        console.error('Error loading summary data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadSummaryData();
  }, [moduleInstance.document_id]);

  const handleSaveExecutiveSummary = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('module_instances')
        .update({
          data: {
            ...moduleInstance.data,
            executive_summary: executiveSummary,
          },
        })
        .eq('id', moduleInstance.id);

      if (error) throw error;
      onSaved();
    } catch (error) {
      console.error('Error saving executive summary:', error);
      alert('Failed to save executive summary');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateAiDraft = async () => {
    if (!siteMetadata || !industryKey || (globalPillars.length === 0 && occupancyDrivers.length === 0)) {
      alert('Please ensure all assessment data is complete before generating an AI summary.');
      return;
    }

    setGenerating(true);
    try {
      const aiSummary = generateRiskEngineeringSummary({
        industryKey,
        siteName: siteMetadata.site_name,
        assessmentDate: siteMetadata.assessment_date,
        totalScore,
        topContributors,
        highPriorityRecommendations: recSummary.highPriorityItems,
        recommendationCounts: recSummary.byPriority,
      });

      const { error } = await supabase
        .from('module_instances')
        .update({
          data: {
            ...moduleInstance.data,
            executive_summary_ai: aiSummary,
          },
        })
        .eq('id', moduleInstance.id);

      if (error) throw error;

      setExecutiveSummaryAi(aiSummary);
      onSaved();
    } catch (error) {
      console.error('Error generating AI summary:', error);
      alert('Failed to generate AI summary');
    } finally {
      setGenerating(false);
    }
  };

  const handleUseAiDraft = () => {
    if (!executiveSummaryAi) {
      alert('Please generate an AI draft first.');
      return;
    }
    setExecutiveSummary(executiveSummaryAi);
  };

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="text-center py-12 text-slate-500">Loading summary...</div>
      </div>
    );
  }

  return (
    <>
    <div className="p-6 max-w-5xl mx-auto space-y-6 pb-24">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Summary & Key Findings</p>
            <p className="text-blue-800">
              The read-only sections below are automatically generated from other modules.
              Use the Executive Summary section to provide a narrative overview for senior management.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Executive Summary
          </h3>
          <button
            onClick={handleSaveExecutiveSummary}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
        <div className="text-sm text-slate-600 mb-2">
          <p>
            Provide a high-level narrative summary for senior management and clients.
            Focus on key findings, overall risk profile, and critical recommendations.
          </p>
        </div>
        <AutoExpandTextarea
          value={executiveSummary}
          onChange={(e) => setExecutiveSummary(e.target.value)}
          placeholder="Enter executive summary here..."
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          minRows={6}
        />
      </div>

      <div className="bg-gradient-to-br from-violet-50 to-blue-50 border border-violet-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-600" />
            AI Summary (Draft)
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handleGenerateAiDraft}
              disabled={generating || !siteMetadata || !industryKey}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              {generating ? 'Generating...' : 'Generate AI draft'}
            </button>
            {executiveSummaryAi && (
              <button
                onClick={handleUseAiDraft}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Copy className="w-4 h-4" />
                Use AI draft
              </button>
            )}
          </div>
        </div>
        <div className="text-sm text-slate-700">
          <p className="mb-2">
            Generate an AI-assisted draft summary based on assessment data. This summary is deterministic
            and uses only the data entered in other modules (150-250 words, UK English, professional tone).
          </p>
          {!siteMetadata || !industryKey ? (
            <p className="text-amber-700 font-medium">
              Complete RE-01 Document Control and RISK_ENGINEERING modules before generating.
            </p>
          ) : null}
        </div>
        {executiveSummaryAi ? (
          <div className="bg-white border border-violet-200 rounded-lg p-4">
            <p className="text-sm text-slate-800 whitespace-pre-wrap">{executiveSummaryAi}</p>
          </div>
        ) : (
          <div className="bg-white border border-dashed border-violet-300 rounded-lg p-4 text-center">
            <p className="text-sm text-slate-500 italic">No AI draft generated yet. Click "Generate AI draft" to create one.</p>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Site Information
        </h3>
        {siteMetadata ? (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-slate-700">Site Name:</span>
              <p className="text-slate-900">{siteMetadata.site_name}</p>
            </div>
            <div>
              <span className="font-medium text-slate-700">Assessor:</span>
              <p className="text-slate-900">{siteMetadata.assessor_name}</p>
            </div>
            <div>
              <span className="font-medium text-slate-700">Address:</span>
              <p className="text-slate-900">{siteMetadata.site_address}</p>
            </div>
            <div>
              <span className="font-medium text-slate-700">Assessment Date:</span>
              <p className="text-slate-900">{siteMetadata.assessment_date}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No site information available. Complete RE-01 Document Control.</p>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Risk Ratings Summary
        </h3>

        {occupancyMissing && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex gap-2 items-start">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900">
                Occupancy not set — risk factors may be incomplete. Set occupancy in RE-03 Occupancy to see all relevant factors.
              </p>
            </div>
          </div>
        )}

        {(globalPillars.length > 0 || occupancyDrivers.length > 0) ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold text-slate-700">Risk Factor</th>
                    <th className="text-center px-4 py-2 font-semibold text-slate-700">Rating</th>
                    <th className="text-center px-4 py-2 font-semibold text-slate-700">Weight</th>
                    <th className="text-center px-4 py-2 font-semibold text-slate-700">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Global Pillars Section */}
                  <tr className="bg-blue-50 border-t-2 border-blue-300">
                    <td colSpan={4} className="px-4 py-2 text-xs font-semibold text-blue-900 uppercase tracking-wide">
                      Global Pillars (Always Included)
                    </td>
                  </tr>
                  {globalPillars.map((factor, idx) => (
                    <tr key={factor.key} className="bg-blue-50/50">
                      <td className="px-4 py-2 text-slate-900 font-medium">{factor.label}</td>
                      <td className="text-center px-4 py-2 text-slate-900">{factor.rating}</td>
                      <td className="text-center px-4 py-2 text-slate-900">{factor.weight}</td>
                      <td className="text-center px-4 py-2 font-medium text-slate-900">{factor.score.toFixed(1)}</td>
                    </tr>
                  ))}

                  {/* Occupancy Loss Drivers Section */}
                  {occupancyDrivers.length > 0 && (
                    <>
                      <tr className="bg-slate-50 border-t-2 border-slate-300">
                        <td colSpan={4} className="px-4 py-2 text-xs font-semibold text-slate-900 uppercase tracking-wide">
                          Occupancy Loss Drivers (Industry-Specific)
                        </td>
                      </tr>
                      {occupancyDrivers.map((factor, idx) => (
                        <tr key={factor.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-4 py-2 text-slate-900">{factor.label}</td>
                          <td className="text-center px-4 py-2 text-slate-900">{factor.rating}</td>
                          <td className="text-center px-4 py-2 text-slate-900">{factor.weight}</td>
                          <td className="text-center px-4 py-2 font-medium text-slate-900">{factor.score.toFixed(1)}</td>
                        </tr>
                      ))}
                    </>
                  )}

                  {/* Total Row */}
                  <tr className="bg-slate-100 border-t-2 border-slate-400 font-semibold">
                    <td className="px-4 py-3 text-slate-900">Total</td>
                    <td className="text-center px-4 py-3"></td>
                    <td className="text-center px-4 py-3"></td>
                    <td className="text-center px-4 py-3 text-slate-900">{totalScore.toFixed(1)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h4 className="font-semibold text-amber-900 mb-2">Top 3 Risk Contributors</h4>
              <div className="space-y-2">
                {topContributors.map((factor, idx) => (
                  <div key={factor.key} className="flex items-center justify-between text-sm">
                    <span className="text-amber-900">
                      <span className="font-semibold">#{idx + 1}</span> {factor.label}
                    </span>
                    <span className="font-medium text-amber-900">Score: {factor.score.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">No risk ratings available. Complete the RISK_ENGINEERING module.</p>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">Recommendations Summary</h3>
        {recSummary.total > 0 ? (
          <>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-900">{recSummary.byPriority.critical}</div>
                <div className="text-xs text-red-700 font-medium">Critical</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-900">{recSummary.byPriority.high}</div>
                <div className="text-xs text-orange-700 font-medium">High</div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-yellow-900">{recSummary.byPriority.medium}</div>
                <div className="text-xs text-yellow-700 font-medium">Medium</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-slate-900">{recSummary.byPriority.low}</div>
                <div className="text-xs text-slate-700 font-medium">Low</div>
              </div>
            </div>

            {recSummary.highPriorityItems.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold text-slate-900 mb-2">High Priority Recommendations</h4>
                <ul className="space-y-2">
                  {recSummary.highPriorityItems.map((item, idx) => (
                    <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                      <span className={`px-2 py-0.5 text-xs rounded font-medium flex-shrink-0 ${
                        item.priority === 'critical'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {item.priority.toUpperCase()}
                      </span>
                      <span className="flex-1">{item.text || 'No description'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-500">No recommendations available. Complete RE-09 Recommendations.</p>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-2">
              <ImageIcon className="w-5 h-5" />
              Supporting Documentation
            </h3>
            <p className="text-sm text-slate-600">
              {hasPhotos && hasSitePlan ? (
                <span className="text-green-600 font-medium">Complete – All documentation uploaded</span>
              ) : (
                <span className="text-amber-600">
                  {!hasPhotos && !hasSitePlan ? 'No documentation uploaded' : 'Partially complete'}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => navigate(`/app/documents/${document.id}?module=RE_SUPPORTING_DOCS`)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <span>View Documentation</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {document?.id && moduleInstance?.id && (
        <ModuleActions documentId={document.id} moduleInstanceId={moduleInstance.id} />
      )}
    </div>

      <FloatingSaveBar onSave={handleSaveExecutiveSummary} isSaving={saving} />
    </>
  );
}
