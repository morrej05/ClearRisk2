import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, CheckCircle2, Clock, XCircle, Sparkles, Building2, X, Download, Loader2 } from 'lucide-react';
import { generateSurveySummary, prepareSurveyDataForSummary } from '../utils/surveySummaryApi';

interface Recommendation {
  id: string;
  hazard: string;
  description: string;
  client_response: string;
  status: string;
  priority?: 'Critical' | 'High' | 'Medium' | 'Low';
  driver_dimension?: string;
  updated_at?: string;
}

interface RecommendationDraftModalProps {
  surveyId: string;
  onClose: () => void;
}

interface Survey {
  id: string;
  property_name: string;
  property_address: string;
  company_name: string;
  survey_date: string;
  issue_date: string;
  form_data: any;
  issued: boolean;
  user_id: string;
}

export default function RecommendationDraftModal({ surveyId, onClose }: RecommendationDraftModalProps) {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [clientBranding, setClientBranding] = useState<{
    companyName: string;
    logoUrl: string | null;
  } | null>(null);

  useEffect(() => {
    fetchSurveyData();
  }, [surveyId]);

  const fetchSurveyData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('survey_reports')
        .select('*')
        .eq('id', surveyId)
        .single();

      if (error) throw error;

      setSurvey(data);

      if (data?.user_id) {
        const { data: brandingData } = await supabase
          .from('client_branding')
          .select('company_name, logo_url')
          .eq('user_id', data.user_id)
          .maybeSingle();

        if (brandingData) {
          setClientBranding({
            companyName: brandingData.company_name,
            logoUrl: brandingData.logo_url,
          });
        }
      }

      const overallComments = data.form_data?.overallComments || [];
      const enrichedRecommendations = overallComments.map((rec: any) => {
        let priority: 'Critical' | 'High' | 'Medium' | 'Low' | undefined;

        if (rec.driver_dimension) {
          const dimensionScores = {
            construction: data.form_data.constructionScore || 0,
            fire_protection: data.form_data.fireProtectionScore || 0,
            detection: data.form_data.detectionScore || 0,
            management: data.form_data.managementScore || 0,
            special_hazards: data.form_data.specialHazardsScore || 0,
            business_interruption: data.form_data.businessInterruptionScore || 0,
          };

          const score = dimensionScores[rec.driver_dimension as keyof typeof dimensionScores];
          if (score > 0) {
            if (score < 40) priority = 'Critical';
            else if (score < 55) priority = 'High';
            else if (score < 70) priority = 'Medium';
            else priority = 'Low';
          }
        }

        return {
          ...rec,
          priority,
        };
      });

      setRecommendations(enrichedRecommendations);
    } catch (error) {
      console.error('Error fetching survey:', error);
      alert('Failed to load survey data.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateAISummary = async () => {
    if (!survey) return;

    setIsGeneratingAI(true);
    try {
      const surveyData = prepareSurveyDataForSummary(survey.form_data);
      const summary = await generateSurveySummary(surveyData);
      setAiSummary(summary);
    } catch (error) {
      console.error('Error generating AI summary:', error);
      alert('Failed to generate AI summary. Please try again.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleDownload = () => {
    window.print();
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const getDimensionLabel = (dimension?: string): string => {
    const labels: Record<string, string> = {
      construction: 'Construction & Combustibility',
      fire_protection: 'Fire Protection',
      detection: 'Detection Systems',
      management: 'Management Systems',
      special_hazards: 'Special Hazards',
      business_interruption: 'Business Interruption',
    };
    return dimension ? labels[dimension] || dimension : 'General';
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'Critical':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'High':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'Medium':
        return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'Low':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Completed':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'In Progress':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'Rejected':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  const getTopRiskDrivers = (): string => {
    if (!survey?.form_data) return 'No risk data available';

    const dimensionScores = {
      'Construction & Combustibility': survey.form_data.constructionScore || 100,
      'Fire Protection': survey.form_data.fireProtectionScore || 100,
      'Detection Systems': survey.form_data.detectionScore || 100,
      'Management Systems': survey.form_data.managementScore || 100,
      'Special Hazards': survey.form_data.specialHazardsScore || 100,
      'Business Interruption': survey.form_data.businessInterruptionScore || 100,
    };

    const sortedDimensions = Object.entries(dimensionScores)
      .sort(([, a], [, b]) => a - b)
      .slice(0, 2);

    if (sortedDimensions.length === 0) return 'No risk drivers identified';

    const drivers = sortedDimensions
      .map(([name, score]) => `${name} (Score: ${score})`)
      .join(', ');

    return `Primary risk drivers for this site: ${drivers}. Recommendations are weighted to address these areas.`;
  };

  const groupedRecommendations = {
    Critical: recommendations.filter(r => r.priority === 'Critical'),
    High: recommendations.filter(r => r.priority === 'High'),
    Medium: recommendations.filter(r => r.priority === 'Medium'),
    Low: recommendations.filter(r => r.priority === 'Low'),
    Unassigned: recommendations.filter(r => !r.priority),
  };

  const statusSummary = recommendations.reduce((acc, rec) => {
    const status = rec.status || 'Not Started';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const prioritySummary = {
    Critical: groupedRecommendations.Critical.length,
    High: groupedRecommendations.High.length,
    Medium: groupedRecommendations.Medium.length,
    Low: groupedRecommendations.Low.length,
  };

  const hasCritical = prioritySummary.Critical > 0;

  const getRiskBand = () => {
    return survey?.form_data?.riskBand || null;
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-300 border-t-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading recommendation draft...</p>
        </div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8">
          <p className="text-slate-600">Survey not found</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-lg shadow-xl">
            <div className="bg-slate-900 text-white px-8 py-6 rounded-t-lg print:hidden">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-bold mb-2">Draft Recommendation Report</h1>
                  <p className="text-slate-300">{survey.property_name}</p>
                </div>
                <button
                  onClick={onClose}
                  className="text-white hover:text-slate-200 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="border-b border-slate-200 px-8 py-4 bg-slate-50 print:hidden">
              <div className="flex items-center justify-between">
                <button
                  onClick={handleGenerateAISummary}
                  disabled={isGeneratingAI}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingAI ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate AI Summary</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="px-8 py-6 border-b border-slate-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Fire Risk Recommendations Report</h2>
                  <p className="text-slate-600">Action-Focused Summary</p>
                </div>
                {clientBranding?.logoUrl ? (
                  <div className="flex-shrink-0 ml-6">
                    <img
                      src={clientBranding.logoUrl}
                      alt={clientBranding.companyName}
                      className="h-16 object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex-shrink-0 ml-6">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Building2 className="w-12 h-12" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-8 py-6 border-b border-slate-200 bg-gradient-to-r from-violet-50 to-blue-50">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-violet-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-900 mb-3">Executive Summary</h3>
                  {aiSummary ? (
                    <>
                      <div className="prose prose-slate max-w-none">
                        <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {aiSummary}
                        </p>
                      </div>
                      <div className="text-xs text-slate-500 border-t border-violet-200 pt-3 mt-4">
                        AI-generated summary based on structured survey data.
                      </div>
                    </>
                  ) : (
                    <div className="bg-white rounded-lg border-2 border-dashed border-violet-300 p-6 text-center">
                      <Sparkles className="w-8 h-8 text-violet-400 mx-auto mb-3" />
                      <p className="text-slate-600 mb-2">No AI summary generated yet</p>
                      <p className="text-sm text-slate-500">
                        Click "Generate AI Summary" in the toolbar above to create an executive summary.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-8 py-6 border-b border-slate-200 bg-slate-50">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-1">Site</h4>
                  <p className="text-lg font-semibold text-slate-900">{survey.property_name}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-1">Company</h4>
                  <p className="text-lg font-semibold text-slate-900">{survey.company_name || '—'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-1">Address</h4>
                  <p className="text-slate-700">{survey.property_address}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-1">Industry Sector</h4>
                  <p className="text-slate-700">{survey.form_data?.industrySector || '—'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-1">Survey Date</h4>
                  <p className="text-slate-700">{formatDate(survey.survey_date)}</p>
                </div>
                {survey.issue_date && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-500 mb-1">Issue Date</h4>
                    <p className="text-slate-700">{formatDate(survey.issue_date)}</p>
                  </div>
                )}
                {getRiskBand() && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-500 mb-1">Overall Risk Band</h4>
                    <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-lg border ${getPriorityColor(getRiskBand())}`}>
                      {getRiskBand()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-8 py-6 space-y-8">
              {recommendations.length === 0 ? (
                <div className="text-center py-16">
                  <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 text-lg mb-2">No recommendations added</p>
                  <p className="text-slate-400 text-sm">Add recommendations to the survey to see them here</p>
                </div>
              ) : (
                <>
                  <section>
                    <h3 className="text-2xl font-bold text-slate-900 mb-4">1. Introduction & Scope</h3>
                    <p className="text-slate-700 leading-relaxed">
                      This document summarises the key fire risk recommendations arising from the fire property risk survey
                      undertaken at the above site. The recommendations are prioritised based on their relative importance
                      to loss prevention and life safety and should be addressed in order of priority.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-2xl font-bold text-slate-900 mb-4">2. Recommendation Summary</h3>

                    {hasCritical && (
                      <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
                        <div className="flex items-start">
                          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                          <div>
                            <h4 className="text-sm font-bold text-red-900 mb-1">Immediate Attention Required</h4>
                            <p className="text-sm text-red-800">
                              One or more critical recommendations have been identified which materially affect
                              the fire risk profile of the site.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-white border border-slate-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-slate-600 mb-3">Priority Breakdown</h4>
                        <div className="space-y-2">
                          {Object.entries(prioritySummary).map(([priority, count]) => (
                            <div key={priority} className="flex items-center justify-between">
                              <span className={`px-2 py-1 text-xs font-semibold rounded border ${getPriorityColor(priority)}`}>
                                {priority}
                              </span>
                              <span className="text-lg font-bold text-slate-900">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-slate-600 mb-3">Status Overview</h4>
                        <div className="space-y-2">
                          {Object.entries(statusSummary).map(([status, count]) => (
                            <div key={status} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(status)}
                                <span className="text-sm text-slate-700">{status || 'Not Started'}</span>
                              </div>
                              <span className="text-lg font-bold text-slate-900">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mt-4">
                      <h4 className="text-sm font-medium text-slate-600 mb-2">Top Risk Drivers</h4>
                      <p className="text-sm text-slate-700">
                        {getTopRiskDrivers()}
                      </p>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-2xl font-bold text-slate-900 mb-6">3. Detailed Recommendations</h3>

                    {(['Critical', 'High', 'Medium', 'Low'] as const).map((priorityLevel) => {
                      const recs = groupedRecommendations[priorityLevel];
                      if (recs.length === 0) return null;

                      return (
                        <div key={priorityLevel} className="mb-8">
                          <h4 className="text-xl font-bold text-slate-900 mb-4">
                            3.{['Critical', 'High', 'Medium', 'Low'].indexOf(priorityLevel) + 1} {priorityLevel} Priority Recommendations
                          </h4>

                          <div className="space-y-4">
                            {recs.map((rec, index) => {
                              const refNumber = `R${String(index + 1).padStart(2, '0')}`;

                              return (
                                <div key={rec.id} className="border border-slate-200 rounded-lg p-6 bg-white hover:shadow-md transition-shadow">
                                  <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                      <span className="text-lg font-bold text-slate-900">{refNumber}</span>
                                      <span className={`px-3 py-1 text-xs font-semibold rounded-lg border ${getPriorityColor(rec.priority)}`}>
                                        {rec.priority}
                                      </span>
                                      {rec.status && (
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-lg">
                                          {getStatusIcon(rec.status)}
                                          <span className="text-xs font-medium text-slate-700">{rec.status}</span>
                                        </div>
                                      )}
                                    </div>
                                    {rec.driver_dimension && (
                                      <span className="text-xs text-slate-500 font-medium">
                                        {getDimensionLabel(rec.driver_dimension)}
                                      </span>
                                    )}
                                  </div>

                                  <div className="space-y-3">
                                    <div>
                                      <h5 className="text-sm font-semibold text-slate-700 mb-1">Recommendation</h5>
                                      <p className="text-slate-900 leading-relaxed">{rec.description || '—'}</p>
                                    </div>

                                    {rec.hazard && (
                                      <div>
                                        <h5 className="text-sm font-semibold text-slate-700 mb-1">Rationale / Hazard</h5>
                                        <p className="text-slate-700 leading-relaxed text-sm">{rec.hazard}</p>
                                      </div>
                                    )}

                                    {rec.client_response && (
                                      <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                                        <h5 className="text-sm font-semibold text-blue-900 mb-1">Client Response</h5>
                                        <p className="text-blue-800 text-sm leading-relaxed">{rec.client_response}</p>
                                      </div>
                                    )}

                                    {rec.updated_at && (
                                      <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <Clock className="w-3 h-3" />
                                        <span>Last updated: {formatDate(rec.updated_at)}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {groupedRecommendations.Unassigned.length > 0 && (
                      <div className="mb-8">
                        <h4 className="text-xl font-bold text-slate-900 mb-4">
                          3.5 Other Recommendations
                        </h4>

                        <div className="space-y-4">
                          {groupedRecommendations.Unassigned.map((rec, index) => {
                            const refNumber = `R${String(index + 1).padStart(2, '0')}`;

                            return (
                              <div key={rec.id} className="border border-slate-200 rounded-lg p-6 bg-white">
                                <div className="flex items-start justify-between mb-4">
                                  <div className="flex items-center gap-3">
                                    <span className="text-lg font-bold text-slate-900">{refNumber}</span>
                                    {rec.status && (
                                      <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-lg">
                                        {getStatusIcon(rec.status)}
                                        <span className="text-xs font-medium text-slate-700">{rec.status}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <div>
                                    <h5 className="text-sm font-semibold text-slate-700 mb-1">Recommendation</h5>
                                    <p className="text-slate-900 leading-relaxed">{rec.description || '—'}</p>
                                  </div>

                                  {rec.hazard && (
                                    <div>
                                      <h5 className="text-sm font-semibold text-slate-700 mb-1">Rationale / Hazard</h5>
                                      <p className="text-slate-700 leading-relaxed text-sm">{rec.hazard}</p>
                                    </div>
                                  )}

                                  {rec.client_response && (
                                    <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                                      <h5 className="text-sm font-semibold text-blue-900 mb-1">Client Response</h5>
                                      <p className="text-blue-800 text-sm leading-relaxed">{rec.client_response}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="border-t border-slate-200 pt-6">
                    <h3 className="text-2xl font-bold text-slate-900 mb-4">4. Responsibility & Disclaimer</h3>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                      <p className="text-sm text-slate-700 leading-relaxed">
                        This recommendations report is based on conditions observed at the time of survey.
                        Implementation of recommendations remains the responsibility of the duty holder.
                        Completion of recommendations does not guarantee elimination of risk. All work should
                        be carried out by competent contractors in accordance with relevant standards and regulations.
                      </p>
                      <p className="text-sm text-slate-600 mt-4 italic">
                        Report generated by ClearRisk on {formatDate(new Date().toISOString())}
                      </p>
                    </div>
                  </section>
                </>
              )}
            </div>

            <div className="px-8 py-6 bg-slate-50 rounded-b-lg border-t border-slate-200 print:hidden">
              <div className="flex justify-between items-center">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export PDF
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
