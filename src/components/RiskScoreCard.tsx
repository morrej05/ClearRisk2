import { getSectorInfo, calculateDimensionContributions, getRiskBandColor, getLowestContributors, DimensionContribution } from '../utils/riskScoring';

interface RiskScoreCardProps {
  industrySector: string;
  overallRiskScore: number;
  riskBand: string;
  constructionScore: number;
  fireProtectionScore: number;
  detectionScore: number;
  managementScore: number;
  specialHazardsScore: number;
  businessInterruptionScore: number;
  wConstruction: number;
  wProtection: number;
  wDetection: number;
  wManagement: number;
  wHazards: number;
  wBi: number;
}

export default function RiskScoreCard({
  industrySector,
  overallRiskScore,
  riskBand,
  constructionScore,
  fireProtectionScore,
  detectionScore,
  managementScore,
  specialHazardsScore,
  businessInterruptionScore,
  wConstruction,
  wProtection,
  wDetection,
  wManagement,
  wHazards,
  wBi,
}: RiskScoreCardProps) {
  if (!industrySector) {
    return null;
  }

  const sectorInfo = getSectorInfo(industrySector);
  const contributions = calculateDimensionContributions(
    constructionScore,
    fireProtectionScore,
    detectionScore,
    managementScore,
    specialHazardsScore,
    businessInterruptionScore,
    {
      construction: wConstruction,
      protection: wProtection,
      detection: wDetection,
      management: wManagement,
      hazards: wHazards,
      bi: wBi,
    }
  );

  const lowestContributors = getLowestContributors(contributions);
  const bandColor = getRiskBandColor(riskBand);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border-2 border-slate-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Overall Risk Score</h3>
            <p className="text-sm text-slate-600">
              Calculated using sector-adjusted weightings for {industrySector}
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-slate-900 mb-1">{overallRiskScore}</div>
            <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border ${bandColor}`}>
              {riskBand}
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-white rounded-lg border border-slate-200">
          <p className="text-sm text-slate-700">
            This score has been calculated using sector-adjusted weightings appropriate to a{' '}
            <strong>{industrySector}</strong> occupancy. The assessment places greatest emphasis on:{' '}
            <strong>{sectorInfo?.emphasis.slice(0, 2).join(', ')}</strong>.
          </p>
          <p className="text-sm text-slate-600 mt-2">
            The score represents an indication of relative fire risk quality and does not predict loss frequency or severity.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h4 className="text-lg font-semibold text-slate-900 mb-4">Dimension Breakdown</h4>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-3 text-sm font-semibold text-slate-700">Risk Area</th>
                <th className="text-center py-3 px-3 text-sm font-semibold text-slate-700">Score</th>
                <th className="text-center py-3 px-3 text-sm font-semibold text-slate-700">Weight</th>
                <th className="text-center py-3 px-3 text-sm font-semibold text-slate-700">Contribution</th>
              </tr>
            </thead>
            <tbody>
              {contributions.map((item: DimensionContribution, index: number) => (
                <tr key={index} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-3 text-sm text-slate-900">{item.name}</td>
                  <td className="py-3 px-3 text-sm text-center font-medium text-slate-900">{item.score}</td>
                  <td className="py-3 px-3 text-sm text-center text-slate-600">{item.percentage}</td>
                  <td className="py-3 px-3 text-sm text-center font-semibold text-slate-900">
                    {item.contribution.toFixed(1)}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td className="py-3 px-3 text-sm text-slate-900">Total</td>
                <td className="py-3 px-3 text-sm text-center text-slate-900">-</td>
                <td className="py-3 px-3 text-sm text-center text-slate-900">100%</td>
                <td className="py-3 px-3 text-sm text-center text-slate-900">{overallRiskScore.toFixed(1)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {lowestContributors.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
          <h4 className="text-base font-semibold text-amber-900 mb-2">What Drives This Score?</h4>
          <p className="text-sm text-amber-800 mb-2">
            The following factors currently have the greatest influence on the overall score:
          </p>
          <ul className="space-y-1">
            {lowestContributors.map((item: DimensionContribution, index: number) => (
              <li key={index} className="text-sm text-amber-900 flex items-start">
                <span className="mr-2">•</span>
                <span>
                  <strong>{item.name}</strong> (Score: {item.score}, Contribution: {item.contribution.toFixed(1)})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sectorInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
          <h4 className="text-base font-semibold text-blue-900 mb-2">
            Sector Risk Context – {sectorInfo.name}
          </h4>
          <p className="text-sm text-blue-800">{sectorInfo.description}</p>
        </div>
      )}
    </div>
  );
}
