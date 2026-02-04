/**
 * DEPRECATED: This component is no longer used in the UI.
 *
 * As of consolidation, RISK_ENGINEERING module now routes to RE14DraftOutputsForm (RE-11 Summary & Key Findings).
 * This provides a single authoritative summary view with:
 * - Global Pillars (always included)
 * - Occupancy Loss Drivers (filtered by industry relevance)
 * - Top 3 contributors
 * - Executive summary editor
 * - Recommendations summary
 * - Supporting documentation status
 *
 * The underlying RISK_ENGINEERING data model and module_instances entry is preserved.
 * Other RE modules continue to write ratings into RISK_ENGINEERING.data.ratings.
 *
 * This file is kept for reference only and may be removed in a future cleanup.
 */

import { useMemo } from 'react';
import { HRG_CANONICAL_KEYS, HRG_MASTER_MAP, humanizeCanonicalKey, humanizeIndustryKey, getHrgConfig } from '../../../lib/re/reference/hrgMasterMap';
import { getRating, calculateScore } from '../../../lib/re/scoring/riskEngineeringHelpers';
import { Info } from 'lucide-react';

interface Document {
  id: string;
  document_type: string;
  title: string;
}

interface ModuleInstance {
  id: string;
  module_key: string;
  outcome: string | null;
  completed_at: string | null;
  assessor_notes: string;
  data: Record<string, any>;
  updated_at: string;
}

interface RiskEngineeringFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

export default function RiskEngineeringForm({ moduleInstance }: RiskEngineeringFormProps) {
  const data = moduleInstance.data || {};
  const industryKey = data.industry_key || null;

  const aggregationData = useMemo(() => {
    const rows = HRG_CANONICAL_KEYS.map((canonicalKey) => {
      const rating = getRating(data, canonicalKey);
      const config = getHrgConfig(industryKey, canonicalKey);
      const score = calculateScore(rating, config.weight);

      return {
        canonicalKey,
        label: humanizeCanonicalKey(canonicalKey),
        rating,
        weight: config.weight,
        score,
        helpText: config.helpText,
      };
    });

    const totalScore = rows.reduce((sum, row) => sum + row.score, 0);
    const maxPossibleScore = rows.reduce((sum, row) => sum + (5 * row.weight), 0);

    return { rows, totalScore, maxPossibleScore };
  }, [data, industryKey]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Risk Engineering Aggregation Module</p>
            <p className="text-blue-800">
              This module displays a read-only summary of risk engineering scores aggregated from RE-01 through RE-14.
              All data entry occurs in the individual RE modules. Industry weighting factors are applied based on the
              industry classification selected in RE-01.
            </p>
          </div>
        </div>
      </div>

      {/* Industry Selection Status */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h3 className="font-semibold text-slate-900 mb-2">Industry Classification</h3>
        {industryKey ? (
          <div className="flex items-center gap-2">
            <span className="text-slate-700">{humanizeIndustryKey(industryKey)}</span>
            <span className="text-xs text-slate-500">(configured in RE-01)</span>
          </div>
        ) : (
          <div className="text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded px-3 py-2">
            No industry selected. Please configure industry classification in RE-01 Document Control to apply appropriate
            weighting factors.
          </div>
        )}
      </div>

      {/* Aggregation Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="bg-slate-100 px-4 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Risk Engineering Score Summary</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Risk Factor</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700 w-32">Engineer Rating</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700 w-32">Industry Weight</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700 w-32">Score</th>
              </tr>
            </thead>
            <tbody>
              {aggregationData.rows.map((row, idx) => (
                <tr
                  key={row.canonicalKey}
                  className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                  title={row.helpText}
                >
                  <td className="px-4 py-3 text-slate-900">
                    <div className="flex items-center gap-2">
                      {row.label}
                      {row.helpText && (
                        <Info className="w-4 h-4 text-slate-400" title={row.helpText} />
                      )}
                    </div>
                  </td>
                  <td className="text-center px-4 py-3">
                    <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-semibold ${
                      row.rating === 5 ? 'bg-emerald-100 text-emerald-700' :
                      row.rating === 4 ? 'bg-green-100 text-green-700' :
                      row.rating === 3 ? 'bg-amber-100 text-amber-700' :
                      row.rating === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {row.rating}
                    </span>
                  </td>
                  <td className="text-center px-4 py-3 text-slate-700 font-medium">
                    {row.weight}
                  </td>
                  <td className="text-center px-4 py-3">
                    <span className="font-semibold text-slate-900">{row.score}</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-300">
                <td className="px-4 py-3 font-semibold text-slate-900">Total Score</td>
                <td className="text-center px-4 py-3"></td>
                <td className="text-center px-4 py-3"></td>
                <td className="text-center px-4 py-3">
                  <span className="text-lg font-bold text-slate-900">
                    {aggregationData.totalScore}
                  </span>
                  <span className="text-xs text-slate-600 ml-1">
                    / {aggregationData.maxPossibleScore}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Rating Scale Reference */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h4 className="font-semibold text-slate-900 mb-3 text-sm">Engineer Rating Scale</h4>
        <div className="grid grid-cols-5 gap-3 text-xs">
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 font-semibold flex items-center justify-center mx-auto mb-1">1</div>
            <div className="text-slate-600">Poor</div>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-700 font-semibold flex items-center justify-center mx-auto mb-1">2</div>
            <div className="text-slate-600">Below Average</div>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 font-semibold flex items-center justify-center mx-auto mb-1">3</div>
            <div className="text-slate-600">Average</div>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 font-semibold flex items-center justify-center mx-auto mb-1">4</div>
            <div className="text-slate-600">Good</div>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 font-semibold flex items-center justify-center mx-auto mb-1">5</div>
            <div className="text-slate-600">Excellent</div>
          </div>
        </div>
      </div>

      {/* Help Text */}
      <div className="text-xs text-slate-600 space-y-1">
        <p><strong>Score Calculation:</strong> Each risk factor score = Engineer Rating × Industry Weight</p>
        <p><strong>Data Source:</strong> Engineer ratings are set in the individual RE module forms (RE-02 through RE-14)</p>
        <p><strong>Industry Weights:</strong> Automatically applied based on industry classification in RE-01</p>
      </div>
    </div>
  );
}
