import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useClientBranding } from '../contexts/ClientBrandingContext';
import ReportCoverPage from './reports/ReportCoverPage';

interface Assessment {
  id: string;
  type: string;
  jurisdiction: string;
  status: string;
  site_name: string;
  site_address: string | null;
  client_name: string | null;
  client_address: string | null;
  assessor_name: string;
  assessor_company: string | null;
  assessment_date: string;
  issued_at: string | null;
}

interface Section {
  section_key: string;
  title: string;
  sort_order: number;
}

interface Response {
  section_key: string;
  notes: string;
}

export default function AssessmentReport() {
  const { id } = useParams<{ id: string }>();
  const { branding } = useClientBranding();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [responses, setResponses] = useState<Record<string, Response>>({});
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

      const { data: sectionsData, error: sectionsError } = await supabase
        .from('assessment_sections')
        .select('section_key, title, sort_order')
        .eq('assessment_type', assessmentData.type)
        .eq('jurisdiction', assessmentData.jurisdiction)
        .order('sort_order', { ascending: true });

      if (sectionsError) throw sectionsError;
      setSections(sectionsData || []);

      const { data: responsesData, error: responsesError } = await supabase
        .from('assessment_responses')
        .select('*')
        .eq('assessment_id', id);

      if (responsesError) throw responsesError;

      const responsesMap: Record<string, Response> = {};
      (responsesData || []).forEach((resp: any) => {
        if (resp.field_key === 'notes') {
          responsesMap[resp.section_key] = {
            section_key: resp.section_key,
            notes: resp.value_json?.text || resp.notes || '',
          };
        }
      });

      setResponses(responsesMap);
    } catch (error) {
      console.error('Error fetching assessment report data:', error);
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

  return (
    <div className="bg-white">
      <ReportCoverPage
        reportType="survey"
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
          {getReportTitle(assessment.type)}
        </h1>

        <div className="space-y-8">
          {sections.map((section, index) => {
            const response = responses[section.section_key];
            const hasContent = response?.notes?.trim();

            return (
              <section key={section.section_key} className="border-b border-neutral-200 pb-8">
                <h2 className="text-2xl font-bold text-neutral-900 mb-4">
                  {index + 1}. {section.title}
                </h2>
                {hasContent ? (
                  <div className="prose prose-neutral max-w-none">
                    <div className="whitespace-pre-wrap text-neutral-700 leading-relaxed">
                      {response.notes}
                    </div>
                  </div>
                ) : (
                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6 text-center">
                    <p className="text-neutral-500 italic">No data added for this section</p>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
