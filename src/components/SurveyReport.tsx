import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useClientBranding } from '../contexts/ClientBrandingContext';
import { FileText, Sparkles, Building2, Calendar } from 'lucide-react';
import ReportCoverPage from './reports/ReportCoverPage';

interface SurveyReportProps {
  surveyId: string;
  surveyType: 'fra' | 'risk_engineering' | 'combined';
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
  generated_report: string | null;
}

interface Building {
  id: string;
  building_name: string;
  year_built?: string;
  building_frame?: string;
  number_of_floors?: string;
  building_height_m?: string;
  floor_area_sqm?: string;
  construction_description?: string;
  construction?: {
    walls?: any;
    roof_ceiling?: any;
  };
  fire_protection?: {
    sprinkler_coverage_pct?: number;
    detection_coverage_pct?: number;
  };
}

export default function SurveyReport({ surveyId, surveyType, embedded = false, aiSummary }: SurveyReportProps) {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { branding: clientBranding } = useClientBranding();

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
      setSurvey(data);
    } catch (error) {
      console.error('Error fetching survey:', error);
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

  const getCombustibilityLabel = (score: number): string => {
    if (score >= 85) return 'Very Good - Predominantly non-combustible';
    if (score >= 70) return 'Good - Mostly non-combustible with limited combustible elements';
    if (score >= 55) return 'Tolerable - Mixed construction with combustible elements';
    if (score >= 40) return 'Poor - Significant combustible construction';
    return 'Very Poor - Highly combustible construction';
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'bg-green-100 text-green-700 border-green-300';
    if (score >= 70) return 'bg-green-50 text-green-600 border-green-200';
    if (score >= 55) return 'bg-amber-100 text-amber-700 border-amber-300';
    if (score >= 40) return 'bg-orange-100 text-orange-700 border-orange-300';
    return 'bg-red-100 text-red-700 border-red-300';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-300 border-t-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading report...</p>
        </div>
      </div>
    );
  }

  if (!survey) return null;

  // HARD STOP: This component is FRA-only.
  // Prevent cross-class report leakage by refusing to render for other survey types.
  if (surveyType !== 'fra') {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Report type mismatch</h2>
        <p className="text-slate-600">
          This report view is only available for Fire Risk (FRA) surveys.
        </p>
      </div>
    );
  }

  const formData = survey.form_data || {};
  const buildings: Building[] = formData.buildings || [];

  const reportContent = (
    <>
      <ReportCoverPage
        reportType="survey"
        clientLogoUrl={clientBranding.logoUrl}
        inspectionDate={survey.survey_date}
        siteName={survey.property_name}
        surveyorName={formData.reviewerName}
        clientName={survey.company_name}
        clientAddress={survey.property_address}
        isDraft={!survey.issued}
      />

      <div className="px-8 py-6 border-b border-slate-200">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Fire Risk Survey Report</h1>
            <p className="text-slate-600">Detailed Survey Findings</p>
          </div>
          {clientBranding.logoUrl ? (
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
                  Click "Generate AI Summary" in the toolbar above to create an executive summary of this survey.
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
            <p className="text-slate-700">{formData.industrySector || '—'}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-500 mb-1">Survey Date</h3>
            <p className="text-slate-700">{formatDate(survey.survey_date)}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-500 mb-1">Survey Type</h3>
            <p className="text-slate-700">{formData.surveyType || 'Full'}</p>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-8">
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">1. Survey Scope & Methodology</h2>

          {formData.inspectionDate && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Inspection Date</h3>
              <p className="text-slate-700">{formatDate(formData.inspectionDate)}</p>
            </div>
          )}

          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Survey Scope</h3>
            <ul className="space-y-1 text-slate-700">
              {formData.surveyScopeVisual && <li>✓ Visual inspection</li>}
              {formData.surveyScopeNonIntrusive && <li>✓ Non-intrusive testing</li>}
              {formData.surveyScopeLimitedAreas && <li>✓ Limited areas access</li>}
              {formData.surveyScopeDesktopReview && <li>✓ Desktop review</li>}
              {formData.surveyScopeOther && formData.surveyScopeOtherText && (
                <li>✓ {formData.surveyScopeOtherText}</li>
              )}
            </ul>
          </div>

          {formData.areasInspected && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Areas Inspected</h3>
              <p className="text-slate-700 whitespace-pre-wrap">{formData.areasInspected}</p>
            </div>
          )}

          {formData.areasNotInspected && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Areas Not Inspected</h3>
              <p className="text-slate-700 whitespace-pre-wrap">{formData.areasNotInspected}</p>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">2. Site Background & Operations</h2>

          {formData.companySiteBackground && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Company & Site Background</h3>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{formData.companySiteBackground}</p>
            </div>
          )}

          {formData.occupancyProductsServices && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Occupancy, Products & Services</h3>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{formData.occupancyProductsServices}</p>
            </div>
          )}

          {formData.employeesOperatingHours && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Employees & Operating Hours</h3>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{formData.employeesOperatingHours}</p>
            </div>
          )}

          {formData.activityOverview && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Activity Overview</h3>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{formData.activityOverview}</p>
            </div>
          )}
        </section>

        {buildings.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">3. Construction & Building Details</h2>

            {formData.constructionScore !== undefined && (
              <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-slate-600 mb-1">Construction Score</h3>
                    <p className="text-slate-700 text-sm">{getCombustibilityLabel(formData.constructionScore)}</p>
                  </div>
                  <div className={`px-4 py-2 rounded-lg border text-2xl font-bold ${getScoreColor(formData.constructionScore)}`}>
                    {formData.constructionScore}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {buildings.map((building: Building, index: number) => (
                <div key={building.id} className="border border-slate-200 rounded-lg p-6 bg-white">
                  <div className="flex items-start gap-3 mb-4">
                    <Building2 className="w-6 h-6 text-slate-600 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-slate-900 mb-2">
                        Building {index + 1}: {building.building_name || 'Unnamed Building'}
                      </h3>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        {building.year_built && (
                          <div>
                            <span className="text-sm text-slate-600">Year Built:</span>
                            <span className="ml-2 font-medium text-slate-900">{building.year_built}</span>
                          </div>
                        )}
                        {building.building_frame && (
                          <div>
                            <span className="text-sm text-slate-600">Frame Type:</span>
                            <span className="ml-2 font-medium text-slate-900">{building.building_frame}</span>
                          </div>
                        )}
                        {building.number_of_floors && (
                          <div>
                            <span className="text-sm text-slate-600">Floors:</span>
                            <span className="ml-2 font-medium text-slate-900">{building.number_of_floors}</span>
                          </div>
                        )}
                        {building.building_height_m && (
                          <div>
                            <span className="text-sm text-slate-600">Height:</span>
                            <span className="ml-2 font-medium text-slate-900">{building.building_height_m}m</span>
                          </div>
                        )}
                        {building.floor_area_sqm && (
                          <div>
                            <span className="text-sm text-slate-600">Floor Area:</span>
                            <span className="ml-2 font-medium text-slate-900">{building.floor_area_sqm}m²</span>
                          </div>
                        )}
                      </div>

                      {building.construction_description && (
                        <div className="mt-4">
                          <h4 className="text-sm font-semibold text-slate-700 mb-2">Construction Description</h4>
                          <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{building.construction_description}</p>
                        </div>
                      )}

                      {building.fire_protection && (
                        <div className="mt-4 grid grid-cols-2 gap-4">
                          {building.fire_protection.sprinkler_coverage_pct !== undefined && (
                            <div className="bg-blue-50 border border-blue-200 rounded p-3">
                              <span className="text-sm text-slate-600">Sprinkler Coverage:</span>
                              <span className="ml-2 font-bold text-blue-700">{building.fire_protection.sprinkler_coverage_pct}%</span>
                            </div>
                          )}
                          {building.fire_protection.detection_coverage_pct !== undefined && (
                            <div className="bg-blue-50 border border-blue-200 rounded p-3">
                              <span className="text-sm text-slate-600">Detection Coverage:</span>
                              <span className="ml-2 font-bold text-blue-700">{building.fire_protection.detection_coverage_pct}%</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">4. Fire Protection Systems</h2>

          {formData.fireProtectionScore !== undefined && (
            <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-slate-600 mb-1">Fire Protection Score</h3>
                </div>
                <div className={`px-4 py-2 rounded-lg border text-2xl font-bold ${getScoreColor(formData.fireProtectionScore)}`}>
                  {formData.fireProtectionScore}
                </div>
              </div>
            </div>
          )}

          {formData.fixedFireProtectionSystems && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Fixed Fire Protection Systems</h3>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{formData.fixedFireProtectionSystems}</p>
            </div>
          )}

          {formData.fireDetectionAlarmSystems && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Fire Detection & Alarm Systems</h3>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{formData.fireDetectionAlarmSystems}</p>
            </div>
          )}

          {formData.waterSupplies && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Water Supplies</h3>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{formData.waterSupplies}</p>
            </div>
          )}

          {!formData.fireProtectionScore && !formData.fixedFireProtectionSystems && !formData.fireDetectionAlarmSystems && !formData.waterSupplies && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
              <p className="text-slate-500 italic">No data added for this section</p>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">5. Management & Controls</h2>

          {formData.managementScore !== undefined && (
            <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-slate-600 mb-1">Management Score</h3>
                </div>
                <div className={`px-4 py-2 rounded-lg border text-2xl font-bold ${getScoreColor(formData.managementScore)}`}>
                  {formData.managementScore}
                </div>
              </div>
            </div>
          )}

          {formData.commitmentLossPrevention && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Commitment to Loss Prevention</h3>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{formData.commitmentLossPrevention}</p>
            </div>
          )}

          {formData.fireEquipmentTesting && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Fire Equipment Testing</h3>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{formData.fireEquipmentTesting}</p>
            </div>
          )}

          {formData.controlHotWork && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Hot Work Controls</h3>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{formData.controlHotWork}</p>
            </div>
          )}

          {formData.electricalMaintenance && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Electrical Maintenance</h3>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{formData.electricalMaintenance}</p>
            </div>
          )}

          {formData.generalMaintenance && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">General Maintenance</h3>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{formData.generalMaintenance}</p>
            </div>
          )}

          {formData.contractorControls && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Contractor Controls</h3>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{formData.contractorControls}</p>
            </div>
          )}

          {formData.impairmentHandling && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Impairment Handling</h3>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{formData.impairmentHandling}</p>
            </div>
          )}

          {formData.smokingControls && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Smoking Controls</h3>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{formData.smokingControls}</p>
            </div>
          )}

          {formData.fireSafetyHousekeeping && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Fire Safety & Housekeeping</h3>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{formData.fireSafetyHousekeeping}</p>
            </div>
          )}

          {formData.emergencyResponse && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Emergency Response</h3>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{formData.emergencyResponse}</p>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">6. Business Interruption</h2>

          {formData.businessInterruptionScore !== undefined && (
            <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-slate-600 mb-1">Business Interruption Score</h3>
                </div>
                <div className={`px-4 py-2 rounded-lg border text-2xl font-bold ${getScoreColor(formData.businessInterruptionScore)}`}>
                  {formData.businessInterruptionScore}
                </div>
              </div>
            </div>
          )}

          {formData.businessInterruption && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Business Interruption Analysis</h3>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{formData.businessInterruption}</p>
            </div>
          )}

          {formData.profitGeneration && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Profit Generation</h3>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{formData.profitGeneration}</p>
            </div>
          )}

          {formData.interdependencies && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Interdependencies</h3>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{formData.interdependencies}</p>
            </div>
          )}

          {formData.bcp && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Business Continuity Planning</h3>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{formData.bcp}</p>
            </div>
          )}
        </section>

        <section className="border-t border-slate-200 pt-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">7. Overall Risk Assessment</h2>

          {formData.overallRiskScore !== undefined && (
            <div className="bg-white border border-slate-200 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-1">Overall Risk Score</h3>
                  {formData.riskBand && (
                    <p className="text-sm text-slate-600">Risk Band: {formData.riskBand}</p>
                  )}
                </div>
                <div className={`px-6 py-3 rounded-lg border text-4xl font-bold ${getScoreColor(formData.overallRiskScore)}`}>
                  {formData.overallRiskScore}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200">
                {formData.constructionScore !== undefined && (
                  <div className="text-center">
                    <div className="text-sm text-slate-600 mb-1">Construction</div>
                    <div className={`inline-block px-3 py-1 rounded font-bold ${getScoreColor(formData.constructionScore)}`}>
                      {formData.constructionScore}
                    </div>
                  </div>
                )}
                {formData.fireProtectionScore !== undefined && (
                  <div className="text-center">
                    <div className="text-sm text-slate-600 mb-1">Fire Protection</div>
                    <div className={`inline-block px-3 py-1 rounded font-bold ${getScoreColor(formData.fireProtectionScore)}`}>
                      {formData.fireProtectionScore}
                    </div>
                  </div>
                )}
                {formData.managementScore !== undefined && (
                  <div className="text-center">
                    <div className="text-sm text-slate-600 mb-1">Management</div>
                    <div className={`inline-block px-3 py-1 rounded font-bold ${getScoreColor(formData.managementScore)}`}>
                      {formData.managementScore}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="border-t border-slate-200 pt-6">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
            <p className="text-sm text-slate-700 leading-relaxed mb-4">
              This survey report documents the fire risk conditions observed at the time of inspection.
              The findings represent a snapshot assessment and should be reviewed in conjunction with
              the accompanying recommendations report.
            </p>
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Report Date: {formatDate(new Date().toISOString())}</span>
              </div>
              {formData.reviewerName && (
                <div>
                  <span>Surveyor: {formData.reviewerName}</span>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      {reportContent}
    </div>
  );
}
