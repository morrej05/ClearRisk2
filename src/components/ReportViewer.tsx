import { Download, Copy, Check, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { ReportSection, SectionId } from '../utils/reportGenerator';

interface ReportViewerProps {
  sections: ReportSection[];
  fullText: string;
  onRegenerateSection: (sectionId: SectionId) => Promise<void>;
}

export default function ReportViewer({ sections, fullText, onRegenerateSection }: ReportViewerProps) {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState<SectionId | null>(null);

  const handleDownload = () => {
    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `survey-report-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const handleRegenerateSection = async (sectionId: SectionId) => {
    setRegenerating(sectionId);
    try {
      await onRegenerateSection(sectionId);
    } finally {
      setRegenerating(null);
    }
  };

  return (
    <div className="mt-12 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
        <h2 className="text-2xl font-bold text-slate-900">Draft Survey Report (AI Generated)</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy All
              </>
            )}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {sections.map((section, index) => (
          <div key={section.id} className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between bg-white border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-500">{index + 1}</span>
                <h3 className="text-lg font-semibold text-slate-900">{section.title}</h3>
                <span className="text-xs text-slate-400 font-mono">[{section.id}]</span>
              </div>
              <button
                onClick={() => handleRegenerateSection(section.id)}
                disabled={regenerating !== null}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${regenerating === section.id ? 'animate-spin' : ''}`} />
                {regenerating === section.id ? 'Regenerating...' : 'Regenerate Section'}
              </button>
            </div>
            <div className="p-4">
              <pre className="whitespace-pre-wrap font-mono text-sm text-slate-800 leading-relaxed">
                {section.content}
              </pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
