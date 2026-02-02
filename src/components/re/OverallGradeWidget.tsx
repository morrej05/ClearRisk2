import { useState, useEffect } from 'react';
import { TrendingUp, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { calculateOverallGrade, getRiskBandFromGrade } from '../../utils/sectionGrades';

interface OverallGradeWidgetProps {
  documentId: string;
  className?: string;
}

export default function OverallGradeWidget({ documentId, className = '' }: OverallGradeWidgetProps) {
  const [sectionGrades, setSectionGrades] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadGrades() {
      setIsLoading(true);
      try {
        const { data: doc, error } = await supabase
          .from('documents')
          .select('section_grades')
          .eq('id', documentId)
          .maybeSingle();

        if (error) {
          console.error('[OverallGradeWidget] Error loading grades:', error);
          return;
        }

        setSectionGrades(doc?.section_grades || {});
      } catch (error) {
        console.error('[OverallGradeWidget] Exception:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadGrades();

    // Subscribe to changes
    const channel = supabase
      .channel(`document-grades-${documentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
          filter: `id=eq.${documentId}`,
        },
        (payload) => {
          if (payload.new && 'section_grades' in payload.new) {
            setSectionGrades((payload.new as any).section_grades || {});
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [documentId]);

  if (isLoading) {
    return (
      <div className={`bg-slate-50 border border-slate-200 rounded-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="h-12 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  const overallGrade = calculateOverallGrade(sectionGrades);
  const riskBand = getRiskBandFromGrade(overallGrade);
  const gradeCount = Object.keys(sectionGrades).length;

  const getGradeColor = (grade: number) => {
    if (grade < 2.0) return 'text-red-700 bg-red-50 border-red-200';
    if (grade < 3.0) return 'text-orange-700 bg-orange-50 border-orange-200';
    if (grade < 4.0) return 'text-amber-700 bg-amber-50 border-amber-200';
    if (grade < 4.5) return 'text-blue-700 bg-blue-50 border-blue-200';
    return 'text-green-700 bg-green-50 border-green-200';
  };

  const getRiskBandColor = (band: string) => {
    switch (band) {
      case 'Critical':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'High':
        return 'text-orange-700 bg-orange-50 border-orange-200';
      case 'Medium':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'Low':
        return 'text-green-700 bg-green-50 border-green-200';
      default:
        return 'text-slate-700 bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className={`bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg shadow-md border-2 border-slate-300 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-slate-600" />
          <h3 className="text-lg font-bold text-slate-900">Overall Property Grade</h3>
        </div>
        {gradeCount === 0 && (
          <div className="flex items-center gap-1 text-xs text-amber-600">
            <AlertCircle className="w-4 h-4" />
            <span>No grades yet</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-6">
        <div className={`flex-1 text-center py-4 px-6 rounded-lg border-2 ${getGradeColor(overallGrade)}`}>
          <div className="text-sm font-medium mb-1">Grade</div>
          <div className="text-4xl font-bold">{overallGrade.toFixed(1)}</div>
          <div className="text-xs mt-1">out of 5.0</div>
        </div>

        <div className={`flex-1 text-center py-4 px-6 rounded-lg border-2 ${getRiskBandColor(riskBand)}`}>
          <div className="text-sm font-medium mb-1">Risk Band</div>
          <div className="text-2xl font-bold">{riskBand}</div>
          <div className="text-xs mt-1">Risk Level</div>
        </div>
      </div>

      {gradeCount > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-300">
          <div className="text-xs text-slate-600">
            Based on {gradeCount} section {gradeCount === 1 ? 'grade' : 'grades'}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(sectionGrades).map(([key, value]) => (
              <div
                key={key}
                className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded text-xs"
              >
                <span className="text-slate-600 capitalize">{key.replace(/_/g, ' ')}:</span>
                <span className="font-semibold text-slate-900">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-slate-300 text-xs text-slate-600">
        <p className="mb-2">
          <strong>Grade Scale:</strong> 1 = High risk/poor, 2 = Material improvement required,
          3 = Adequate/tolerable, 4 = Good, 5 = Very good/low risk
        </p>
        <p>
          <strong>Risk Bands:</strong> Critical (&lt;2.0), High (2.0-2.9), Medium (3.0-3.9), Low (≥4.0)
        </p>
      </div>
    </div>
  );
}
