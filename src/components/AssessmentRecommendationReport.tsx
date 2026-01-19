import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useClientBranding } from '../contexts/ClientBrandingContext';
import { AlertCircle } from 'lucide-react';
import ReportCoverPage from './reports/ReportCoverPage';

interface Assessment {
  id: string;
  type: string;
  site_name: string;
  site_address: string | null;
  client_name: string | null;
  client_address: string | null;
  assessor_name: string;
  assessment_date: string;
  status: string;
  issued_at: string | null;
}

interface Recommendation {
  id: string;
  hazard: string;
  description_final: string;
  priority: number;
  driver_dimension: string | null;
}

export default function AssessmentRecommendationReport() {
  const { id } = useParams<{ id: string }>();
  const { branding } = useClientBranding();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    if (!id) return;

    setIsLoading(true);
    try {
      const { data: assessmentData, error: assessmentError } = await supabase
        .from('assessments')
        .select('*')
        .eq('id', id)
        .single();

      if (assessmentError) throw assessmentError;
      setAssessment(assessmentData);

      const { data: recsData, error: recsError } = await supabase
        .from('survey_recommendations')
        .select('*')
        .eq('assessment_id', id)
        .eq('include_in_report', true)
        .order('priority', { ascending: false });

      if (recsError) throw recsError;
      setRecommendations(recsData || []);
    } catch (error) {
      console.error('Error fetching assessment recommendation report data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getReportTitle = (type: string) => {
    switch (type) {
      case 'fra':
        return 'EziRisk Fire Risk Assessment Report';
      case 'fire_strategy':
        return 'EziRisk Fire Strategy Report';
      case 'dsear':
        return 'EziRisk DSEAR Assessment Report';
      case 'wildfire':
        return 'EziRisk Wildfire Risk Assessment Report';
      default:
        return 'EziRisk Assessment Report';
    }
  };

  const getPriorityLabel = (priority: number) => {
    if (priority >= 4) return 'High';
    if (priority === 3) return 'Medium';
    return 'Low';
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 4) return 'bg-red-100 text-red-700 border-red-300';
    if (priority === 3) return 'bg-amber-100 text-amber-700 border-amber-300';
    return 'bg-blue-100 text-blue-700 border-blue-300';
  };

  const getDimensionLabel = (dimension?: string | null): string => {
    const labels: Record<string, string> = {
      construction: 'Construction',
      fire_protection: 'Fire Protection',
      detection: 'Detection',
      management: 'Management',
      special_hazards: 'Special Hazards',
      business_interruption: 'Business Interruption',
    };
    return dimension ? labels[dimension] || dimension : 'General';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-neutral-300 border-t-neutral-900"></div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="text-center py-16">
        <p className="text-neutral-600">Assessment not found</p>
      </div>
    );
  }

  const hasCritical = recommendations.some(r => r.priority >= 4);

  return (
    <div className="bg-white">
      <ReportCoverPage
        reportType="recommendation"
        clientLogoUrl={branding.logoUrl}
        inspectionDate={assessment.assessment_date}
        siteName={assessment.site_name}
        surveyorName={assessment.assessor_name}
        clientName={assessment.client_name}
        clientAddress={assessment.client_address}
        isDraft={assessment.status === 'draft' || !assessment.issued_at}
      />

      <div className="px-8 py-6">
        <h1 className="text-3xl font-bold text-neutral-900 mb-8">
          {getReportTitle(assessment.type)} - Recommendations
        </h1>

        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">1. Introduction</h2>
            <p className="text-neutral-700 leading-relaxed">
              This document summarises the key recommendations arising from the assessment
              undertaken at the above site. The recommendations are prioritised based on their relative importance
              to risk reduction and should be addressed in order of priority.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">2. Recommendation Summary</h2>

            {hasCritical && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-red-900 mb-1">Immediate Attention Required</h3>
                    <p className="text-sm text-red-800">
                      One or more high priority recommendations have been identified which materially affect
                      the risk profile of the site.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {recommendations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-neutral-200">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-900 border-b border-neutral-200">
                        Ref
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-900 border-b border-neutral-200">
                        Category
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-900 border-b border-neutral-200">
                        Recommendation
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-900 border-b border-neutral-200">
                        Priority
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recommendations.map((rec, index) => {
                      const truncatedDesc = rec.description_final && rec.description_final.length > 200
                        ? rec.description_final.substring(0, 200) + '...'
                        : rec.description_final || rec.hazard || '—';

                      return (
                        <tr key={rec.id} className={index % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                          <td className="px-4 py-3 text-sm text-neutral-900 border-b border-neutral-200 whitespace-nowrap font-medium">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3 text-sm text-neutral-700 border-b border-neutral-200">
                            {getDimensionLabel(rec.driver_dimension)}
                          </td>
                          <td className="px-4 py-3 text-sm text-neutral-700 border-b border-neutral-200">
                            {truncatedDesc}
                          </td>
                          <td className="px-4 py-3 text-sm border-b border-neutral-200">
                            <span className={`inline-block px-2 py-1 text-xs font-semibold rounded border ${getPriorityColor(rec.priority)}`}>
                              {getPriorityLabel(rec.priority)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6 text-center">
                <p className="text-neutral-600">No recommendations recorded for this assessment.</p>
              </div>
            )}
          </section>

          {recommendations.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold text-neutral-900 mb-4">3. Detailed Recommendations</h2>

              <div className="space-y-6">
                {recommendations.map((rec, index) => (
                  <div key={rec.id} className="border border-neutral-200 rounded-lg p-6 bg-white">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-neutral-900">{index + 1}</span>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-lg border ${getPriorityColor(rec.priority)}`}>
                          {getPriorityLabel(rec.priority)}
                        </span>
                      </div>
                      {rec.driver_dimension && (
                        <span className="text-xs text-neutral-500 font-medium">
                          {getDimensionLabel(rec.driver_dimension)}
                        </span>
                      )}
                    </div>

                    <div className="space-y-3">
                      {rec.hazard && (
                        <div>
                          <h4 className="text-base font-bold text-neutral-900">{rec.hazard}</h4>
                        </div>
                      )}

                      {rec.description_final && (
                        <div>
                          <p className="text-neutral-900 leading-relaxed whitespace-pre-wrap">{rec.description_final}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
