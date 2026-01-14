import { X, Download, Calendar, User, FileText, AlertTriangle, FileText as ReportIcon, List, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { ReportSection } from '../utils/reportGenerator';

interface DraftReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sections: ReportSection[];
  fullText: string;
  onDownload: () => void;
  propertyName?: string;
  referenceNumber?: string;
  reportStatus?: 'Draft' | 'Internally Reviewed' | 'Issue Ready';
  inspectionDate?: string;
  surveyorName?: string;
  recommendations?: Array<{ title: string; description: string }>;
}

export default function DraftReportModal({
  isOpen,
  onClose,
  sections,
  fullText,
  onDownload,
  propertyName = 'Untitled Property',
  referenceNumber = 'N/A',
  reportStatus = 'Draft',
  inspectionDate = '',
  surveyorName = '',
  recommendations = [],
}: DraftReportModalProps) {
  const [aiSummary, setAiSummary] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleGenerateAI = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const summary = `Executive Summary

This ${reportStatus.toLowerCase()} fire risk assessment provides a comprehensive evaluation of ${propertyName}.

Key Findings:
• ${sections.length} sections analyzed covering construction, fire protection, detection systems, and management
• ${recommendations.length} recommendations identified for risk mitigation
• Overall assessment indicates areas requiring attention and improvement

Critical Areas:
The assessment has identified several key risk factors that require management attention. Priority recommendations focus on enhancing fire safety systems, improving management controls, and addressing specific hazards identified during the site inspection.

Next Steps:
Implementation of the recommendations outlined in this report will significantly improve the overall fire risk profile of the facility. Regular review and monitoring are essential to maintain and enhance fire safety standards.`;
      setAiSummary(summary);
      setIsGenerating(false);
    }, 1500);
  };

  const handleDownloadSurvey = () => {
    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `survey-report-${referenceNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadRecommendations = () => {
    let recText = `RECOMMENDATION REPORT\n\nProperty: ${propertyName}\nReference: ${referenceNumber}\nDate: ${inspectionDate}\n\n`;
    recText += `SUMMARY OF RECOMMENDATIONS\n${'='.repeat(50)}\n\n`;

    recommendations.forEach((rec, index) => {
      recText += `${index + 1}. ${rec.title}\n`;
      recText += `   ${rec.description}\n\n`;
    });

    const blob = new Blob([recText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recommendations-${referenceNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isDraft = reportStatus !== 'Issue Ready';
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft':
        return 'bg-slate-100 text-slate-700';
      case 'Internally Reviewed':
        return 'bg-amber-100 text-amber-700';
      case 'Issue Ready':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-end">
      <div
        className="absolute inset-0"
        onClick={onClose}
      />

      <div className="relative bg-white h-full w-full max-w-4xl shadow-2xl flex flex-col animate-slide-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-xl font-bold text-slate-900">
            Report Preview
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerateAI}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium shadow-sm disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {isGenerating ? 'Generating...' : 'Generate AI Summary'}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-6 h-6 text-slate-600" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-slate-200">
            <div className="p-8 border-b border-slate-200 bg-gradient-to-br from-slate-50 to-white">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 mb-2">{propertyName}</h1>
                  <div className="flex items-center gap-4 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span className="font-mono">{referenceNumber}</span>
                    </div>
                    {inspectionDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(inspectionDate)}</span>
                      </div>
                    )}
                    {surveyorName && (
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{surveyorName}</span>
                      </div>
                    )}
                  </div>
                </div>
                <span
                  className={`inline-flex px-3 py-1.5 text-sm font-medium rounded-full ${getStatusColor(reportStatus)}`}
                >
                  {reportStatus}
                </span>
              </div>

              {isDraft ? (
                <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900 mb-1">
                        THIS REPORT IS A DRAFT AND SUBJECT TO REVIEW
                      </p>
                      <p className="text-sm text-amber-800">
                        This document has not been finalized and may contain incomplete or unverified information.
                        Please do not distribute until marked as Issue Ready.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    This report has been prepared based on observations made during the site inspection.
                    The findings and recommendations represent professional opinions based on the information
                    available at the time of the survey.
                  </p>
                </div>
              )}
            </div>

            {aiSummary && (
              <div className="p-8 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-violet-600" />
                  <h2 className="text-lg font-bold text-slate-900">AI-Generated Summary</h2>
                </div>
                <div className="prose prose-slate max-w-none">
                  <pre className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed font-sans bg-white p-4 rounded-lg border border-slate-200">
                    {aiSummary}
                  </pre>
                </div>
              </div>
            )}

            <div className="p-8">
              {sections.map((section, index) => (
                <div key={section.id} className="mb-8 last:mb-0">
                  <div className="bg-slate-900 text-white px-4 py-3 rounded-t-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold opacity-75">Section {index + 1}</span>
                      <h2 className="text-lg font-bold">{section.title}</h2>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 border-t-0 rounded-b-lg p-6">
                    <div className="prose prose-slate max-w-none">
                      <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {section.content}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-slate-200 bg-slate-50">
              <div className="flex flex-col gap-3">
                <p className="text-sm text-slate-600 mb-2">Download separate reports:</p>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={handleDownloadSurvey}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                  >
                    <ReportIcon className="w-5 h-5" />
                    Survey Report
                  </button>
                  <button
                    onClick={handleDownloadRecommendations}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
                  >
                    <List className="w-5 h-5" />
                    Recommendation Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
