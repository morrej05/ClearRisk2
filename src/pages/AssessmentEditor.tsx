import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { canAccessPillarB } from '../utils/entitlements';
import { ArrowLeft, Save, FileText, ListChecks, Lock, CheckCircle2 } from 'lucide-react';

interface Section {
  id: string;
  section_key: string;
  title: string;
  sort_order: number;
  is_required: boolean;
}

interface Assessment {
  id: string;
  type: string;
  jurisdiction: string;
  status: string;
  site_name: string;
  issued_at: string | null;
}

interface Response {
  section_key: string;
  notes: string;
  rating?: string;
}

export default function AssessmentEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, userProfile, organisation } = useAuth();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [responses, setResponses] = useState<Record<string, Response>>({});
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const hasAccess = user && userProfile && organisation
    ? canAccessPillarB(userProfile, organisation)
    : false;

  useEffect(() => {
    if (hasAccess && id) {
      fetchAssessment();
    } else {
      setIsLoading(false);
    }
  }, [hasAccess, id]);

  const fetchAssessment = async () => {
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
        .select('*')
        .eq('assessment_type', assessmentData.type)
        .eq('jurisdiction', assessmentData.jurisdiction)
        .order('sort_order', { ascending: true });

      if (sectionsError) throw sectionsError;
      setSections(sectionsData || []);

      if (sectionsData && sectionsData.length > 0 && !activeSection) {
        setActiveSection(sectionsData[0].section_key);
      }

      const { data: responsesData, error: responsesError } = await supabase
        .from('assessment_responses')
        .select('*')
        .eq('assessment_id', id);

      if (responsesError) throw responsesError;

      const responsesMap: Record<string, Response> = {};
      (responsesData || []).forEach((resp: any) => {
        if (!responsesMap[resp.section_key]) {
          responsesMap[resp.section_key] = {
            section_key: resp.section_key,
            notes: '',
            rating: resp.rating,
          };
        }
        if (resp.field_key === 'notes') {
          responsesMap[resp.section_key].notes = resp.value_json?.text || resp.notes || '';
        }
      });

      setResponses(responsesMap);
    } catch (error) {
      console.error('Error fetching assessment:', error);
      alert('Failed to load assessment');
      navigate('/assessments');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id || !activeSection) return;

    setIsSaving(true);
    try {
      const response = responses[activeSection] || { section_key: activeSection, notes: '' };

      const { data: existing } = await supabase
        .from('assessment_responses')
        .select('id')
        .eq('assessment_id', id)
        .eq('section_key', activeSection)
        .eq('field_key', 'notes')
        .maybeSingle();

      if (existing) {
        await supabase
          .from('assessment_responses')
          .update({
            value_json: { text: response.notes },
            notes: response.notes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('assessment_responses')
          .insert({
            assessment_id: id,
            section_key: activeSection,
            field_key: 'notes',
            value_json: { text: response.notes },
            notes: response.notes,
          });
      }

      await supabase
        .from('assessments')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', id);

    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleIssue = async () => {
    if (!id || !assessment) return;

    const confirm = window.confirm(
      'Are you sure you want to issue this assessment? Once issued, the DRAFT watermark will be removed.'
    );
    if (!confirm) return;

    try {
      await supabase
        .from('assessments')
        .update({
          status: 'issued',
          issued_at: new Date().toISOString(),
        })
        .eq('id', id);

      setAssessment({ ...assessment, status: 'issued', issued_at: new Date().toISOString() });
      alert('Assessment issued successfully');
    } catch (error) {
      console.error('Error issuing assessment:', error);
      alert('Failed to issue assessment');
    }
  };

  const updateNotes = (sectionKey: string, notes: string) => {
    setResponses((prev) => ({
      ...prev,
      [sectionKey]: {
        section_key: sectionKey,
        notes,
        rating: prev[sectionKey]?.rating,
      },
    }));
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'fra':
        return 'Fire Risk Assessment';
      case 'fire_strategy':
        return 'Fire Strategy Document';
      case 'dsear':
        return 'ATEX/DSEAR';
      case 'wildfire':
        return 'Wildfire Risk Assessment';
      default:
        return type;
    }
  };

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg border border-neutral-200 p-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-amber-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-3 text-center">
            Professional Feature
          </h2>
          <p className="text-neutral-600 mb-6 text-center">
            Upgrade to Professional to access regulated assessments.
          </p>
          <button
            onClick={() => navigate('/upgrade')}
            className="w-full bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-semibold mb-4"
          >
            Upgrade to Professional
          </button>
          <p className="text-xs text-neutral-500 text-center">
            Already upgraded? Try refreshing the page or signing out and back in to sync your plan status.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-neutral-300 border-t-neutral-900"></div>
      </div>
    );
  }

  if (!assessment) {
    return null;
  }

  const currentSection = sections.find((s) => s.section_key === activeSection);

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="border-b border-neutral-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/assessments')}
                className="text-neutral-600 hover:text-neutral-900"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-neutral-900">{assessment.site_name}</h1>
                <p className="text-sm text-neutral-600">{getTypeLabel(assessment.type)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {assessment.status === 'draft' && (
                <button
                  onClick={handleIssue}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Issue Report
                </button>
              )}
              <button
                onClick={() => navigate(`/assessments/${id}/report`)}
                className="flex items-center gap-2 border border-neutral-300 text-neutral-700 px-4 py-2 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                <FileText className="w-4 h-4" />
                Assessment Report
              </button>
              <button
                onClick={() => navigate(`/assessments/${id}/recommendations`)}
                className="flex items-center gap-2 border border-neutral-300 text-neutral-700 px-4 py-2 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                <ListChecks className="w-4 h-4" />
                Recommendations
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        <div className="w-64 bg-white border-r border-neutral-200 min-h-screen p-4">
          <h2 className="text-sm font-semibold text-neutral-900 mb-4 uppercase tracking-wide">
            Sections
          </h2>
          <nav className="space-y-1">
            {sections.map((section) => {
              const hasContent = responses[section.section_key]?.notes?.trim().length > 0;
              return (
                <button
                  key={section.section_key}
                  onClick={() => setActiveSection(section.section_key)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeSection === section.section_key
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{section.title}</span>
                    {hasContent && (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex-1 p-8">
          <div className="max-w-4xl">
            {currentSection && (
              <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-8">
                <h2 className="text-2xl font-bold text-neutral-900 mb-6">
                  {currentSection.title}
                  {currentSection.is_required && (
                    <span className="text-red-600 ml-2">*</span>
                  )}
                </h2>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={responses[activeSection]?.notes || ''}
                      onChange={(e) => updateNotes(activeSection, e.target.value)}
                      rows={15}
                      className="w-full border border-neutral-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                      placeholder="Enter your notes for this section..."
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex items-center gap-2 bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving ? 'Saving...' : 'Save Section'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
