import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, CheckCircle2, Clock, XCircle, Sparkles } from 'lucide-react';

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

interface RecommendationReportProps {
  surveyId: string | null;
  onClose: () => void;
  embedded?: boolean;
  aiSummary?: string;
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
}

export default function RecommendationReport({ surveyId, onClose, embedded = false, aiSummary }: RecommendationReportProps) {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (surveyId) {
      fetchSurveyData();
    }
  }, [surveyId]);

  const fetchSurveyData = async () => {
    if (!surveyId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('survey_reports')
        .select('*')
        .eq('id', surveyId)
        .single();

      if (error) throw error;

      if (!data.issued) {
        alert('Recommendation reports are only available for issued surveys.');
        onClose();
        return;
      }

      setSurvey(data);

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
      <div className={embedded ? "flex items-center justify-center py-16" : "fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"}>
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-300 border-t-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading report...</p>
        </div>
      </div>
    );
  }

  if (!survey) return null;

  const reportContent = (
    <>
      {!embedded && (
        <div className="bg-slate-900 text-white px-8 py-6 rounded-t-lg">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-2">Fire Risk Recommendations Report</h1>
              <p className="text-slate-300">Action-Focused Summary</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-slate-200 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {embedded && (
        <div className="px-8 py-6 border-b border-slate-200">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Fire Risk Recommendations Report</h1>
          <p className="text-slate-600">Action-Focused Summary</p>
        </div>
      )}

      <div className="px-8 py-6 border-b border-slate-200 bg-gradient-to-r from-violet-50 to-blue-50">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-violet-600 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-900 mb-3">Executive Summary</h2>
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
                  <h3 className="text-sm font-medium text-slate-500 mb-1">Site</h3>
                  <p className="text-lg font-semibold text-slate-900">{survey.property_name}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-1">Company</h3>
                  <p className="text-lg font-semibold text-slate-900">{survey.company_name || '—'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-1">Address</h3>
                  <p className="text-slate-700">{survey.property_address}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-1">Industry Sector</h3>
                  <p className="text-slate-700">{survey.form_data?.industrySector || '—'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-1">Survey Date</h3>
                  <p className="text-slate-700">{formatDate(survey.survey_date)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-1">Issue Date</h3>
                  <p className="text-slate-700">{formatDate(survey.issue_date)}</p>
                </div>
                {getRiskBand() && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-500 mb-1">Overall Risk Band</h3>
                    <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-lg border ${getPriorityColor(getRiskBand())}`}>
                      {getRiskBand()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-8 py-6 space-y-8">
              <section>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">1. Introduction & Scope</h2>
                <p className="text-slate-700 leading-relaxed">
                  This document summarises the key fire risk recommendations arising from the fire property risk survey
                  undertaken at the above site. The recommendations are prioritised based on their relative importance
                  to loss prevention and life safety and should be addressed in order of priority.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">2. Recommendation Summary</h2>

                {hasCritical && (
                  <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
                    <div className="flex items-start">
                      <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                      <div>
                        <h3 className="text-sm font-bold text-red-900 mb-1">Immediate Attention Required</h3>
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
                    <h3 className="text-sm font-medium text-slate-600 mb-3">Priority Breakdown</h3>
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
                    <h3 className="text-sm font-medium text-slate-600 mb-3">Status Overview</h3>
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
                  <h3 className="text-sm font-medium text-slate-600 mb-2">Top Risk Drivers</h3>
                  <p className="text-sm text-slate-700">
                    {getTopRiskDrivers()}
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-slate-900 mb-6">3. Detailed Recommendations</h2>

                {(['Critical', 'High', 'Medium', 'Low'] as const).map((priorityLevel) => {
                  const recs = groupedRecommendations[priorityLevel];
                  if (recs.length === 0) return null;

                  return (
                    <div key={priorityLevel} className="mb-8">
                      <h3 className="text-xl font-bold text-slate-900 mb-4">
                        3.{['Critical', 'High', 'Medium', 'Low'].indexOf(priorityLevel) + 1} {priorityLevel} Priority Recommendations
                      </h3>

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
                                {rec.risk_dimension && (
                                  <span className="text-xs text-slate-500 font-medium">
                                    {getDimensionLabel(rec.risk_dimension)}
                                  </span>
                                )}
                              </div>

                              <div className="space-y-3">
                                {rec.title && (
                                  <div>
                                    <h4 className="text-base font-bold text-slate-900">{rec.title}</h4>
                                  </div>
                                )}
                                <div>
                                  <h4 className="text-sm font-semibold text-slate-700 mb-1">Recommendation</h4>
                                  <p className="text-slate-900 leading-relaxed">{rec.description || '—'}</p>
                                </div>

                                {rec.hazard && (
                                  <div>
                                    <h4 className="text-sm font-semibold text-slate-700 mb-1">Rationale / Hazard</h4>
                                    <p className="text-slate-700 leading-relaxed text-sm">{rec.hazard}</p>
                                  </div>
                                )}

                                {rec.client_response && (
                                  <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                                    <h4 className="text-sm font-semibold text-blue-900 mb-1">Client Response</h4>
                                    <p className="text-blue-800 text-sm leading-relaxed">{rec.client_response}</p>
                                  </div>
                                )}

                                {rec.updated_at && (
                                  <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <Clock className="w-3 h-3" />
                                    <span>Last updated: {formatDate(rec.updated_at)}</span>
                                    {rec.updated_by && <span className="ml-1">by {rec.updated_by}</span>}
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
                    <h3 className="text-xl font-bold text-slate-900 mb-4">
                      3.5 Other Recommendations
                    </h3>

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
                                <h4 className="text-sm font-semibold text-slate-700 mb-1">Recommendation</h4>
                                <p className="text-slate-900 leading-relaxed">{rec.description || '—'}</p>
                              </div>

                              {rec.hazard && (
                                <div>
                                  <h4 className="text-sm font-semibold text-slate-700 mb-1">Rationale / Hazard</h4>
                                  <p className="text-slate-700 leading-relaxed text-sm">{rec.hazard}</p>
                                </div>
                              )}

                              {rec.client_response && (
                                <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                                  <h4 className="text-sm font-semibold text-blue-900 mb-1">Client Response</h4>
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
                <h2 className="text-2xl font-bold text-slate-900 mb-4">4. Responsibility & Disclaimer</h2>
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
            </div>

            {!embedded && (
              <div className="px-8 py-6 bg-slate-50 rounded-b-lg border-t border-slate-200">
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => window.print()}
                    className="px-6 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    Print Report
                  </button>
                  <button
                    onClick={onClose}
                    className="px-6 py-2 bg-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-300 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
    </>
  );

  if (embedded) {
    return reportContent;
  }

  return (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-50 z-50 overflow-y-auto">
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-lg shadow-xl">
            {reportContent}
          </div>
        </div>
      </div>
    </div>
  );
}
