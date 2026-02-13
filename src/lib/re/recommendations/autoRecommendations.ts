import { humanizeCanonicalKey } from '../reference/hrgMasterMap';

export interface Recommendation {
  id: string;
  canonical_key: string;
  priority: 'high' | 'medium' | 'low';
  text: string;
  createdBy: 'auto' | 'manual';
  createdAt: string;
}

const RECOMMENDATION_TEMPLATES: Record<string, (severity: 'critical' | 'moderate') => string> = {
  process_control_and_stability: (severity) =>
    severity === 'critical'
      ? 'CRITICAL: Process control and stability requires immediate improvement. Review and upgrade instrumentation, implement robust control loops, and establish clear operational procedures to prevent process deviations.'
      : 'Process control systems need enhancement. Recommend review of control strategies, upgrade aging instrumentation, and implement additional monitoring for critical parameters.',

  safety_and_control_systems: (severity) =>
    severity === 'critical'
      ? 'CRITICAL: Fire protection and safety systems are inadequate. Immediate action required to upgrade detection, suppression, and emergency response systems to meet acceptable standards.'
      : 'Fire protection systems require improvement. Recommend installation of additional detection coverage, upgrade suppression systems, and enhance emergency response procedures.',

  natural_hazard_exposure_and_controls: (severity) =>
    severity === 'critical'
      ? 'CRITICAL: Natural hazard exposure presents severe risk. Implement immediate physical protection measures, flood barriers, seismic bracing, or other controls appropriate to site-specific perils.'
      : 'Natural hazard controls need strengthening. Review site exposure to flood, wind, earthquake and implement appropriate mitigation measures based on risk assessment.',

  electrical_and_utilities_reliability: (severity) =>
    severity === 'critical'
      ? 'CRITICAL: Electrical and utilities infrastructure is unreliable. Install backup power systems, upgrade critical electrical distribution, and implement redundancy for essential utilities.'
      : 'Utilities reliability requires improvement. Recommend installation of UPS systems, backup generators, or enhanced utility monitoring and maintenance programs.',

  process_safety_management: (severity) =>
    severity === 'critical'
      ? 'CRITICAL: Process safety management is severely deficient. Establish comprehensive PSM program including procedures, training, maintenance systems, and safety culture initiatives immediately.'
      : 'Process safety management needs development. Enhance safety procedures, improve training programs, and strengthen maintenance and inspection regimes.',

  flammable_liquids_and_fire_risk: (severity) =>
    severity === 'critical'
      ? 'CRITICAL: Flammable liquid storage and handling presents unacceptable fire risk. Implement proper segregation, containment, fire protection, and control measures urgently.'
      : 'Flammable materials handling needs improvement. Enhance storage arrangements, improve containment and separation, and upgrade fire protection for storage areas.',

  critical_equipment_reliability: (severity) =>
    severity === 'critical'
      ? 'CRITICAL: Critical equipment reliability is poor with high failure risk. Implement immediate preventive maintenance program, condition monitoring, and spare parts management.'
      : 'Equipment reliability requires enhancement. Develop comprehensive maintenance program, implement condition-based monitoring, and establish critical spares inventory.',

  high_energy_materials_control: (severity) =>
    severity === 'critical'
      ? 'CRITICAL: High-energy materials present severe hazard. Implement stringent controls for reactive chemicals or explosives including segregation, quantity limits, and specialized handling procedures.'
      : 'High-energy materials handling needs improvement. Review storage arrangements, enhance control measures, and implement additional safety protocols for reactive substances.',

  high_energy_process_equipment: (severity) =>
    severity === 'critical'
      ? 'CRITICAL: High-pressure or high-energy equipment presents major hazard. Conduct immediate inspection program, upgrade relief systems, and implement enhanced monitoring and maintenance.'
      : 'High-energy equipment requires improved controls. Enhance inspection programs, upgrade safety systems, and implement additional monitoring for pressure vessels and energetic equipment.',

  emergency_response_and_bcp: (severity) =>
    severity === 'critical'
      ? 'CRITICAL: Emergency response and business continuity capabilities are inadequate. Develop comprehensive emergency plans, establish response teams, and implement business continuity strategies immediately.'
      : 'Emergency preparedness needs strengthening. Enhance emergency response procedures, conduct regular drills, and develop robust business continuity plans.',
};

export function buildAutoRecommendation(
  canonicalKey: string,
  rating: number,
  industryKey: string | null
): Recommendation | null {
  if (rating > 2) {
    return null;
  }

  const severity = rating === 1 ? 'critical' : 'moderate';
  const priority = rating === 1 ? 'high' : 'medium';

  const template = RECOMMENDATION_TEMPLATES[canonicalKey];
  const text = template ? template(severity) : `${humanizeCanonicalKey(canonicalKey)} requires improvement to meet acceptable standards.`;

  return {
    id: `auto-${canonicalKey}-${Date.now()}`,
    canonical_key: canonicalKey,
    priority,
    text,
    createdBy: 'auto',
    createdAt: new Date().toISOString(),
  };
}

export function shouldCreateAutoRecommendation(
  existingRecommendations: Recommendation[],
  canonicalKey: string,
  rating: number
): boolean {
  if (rating > 2) {
    return false;
  }

  const hasAutoRec = existingRecommendations.some(
    (rec) => rec.canonical_key === canonicalKey && rec.createdBy === 'auto'
  );

  return !hasAutoRec;
}

export function ensureAutoRecommendation(
  data: Record<string, any>,
  canonicalKey: string,
  rating: number,
  industryKey: string | null
): Record<string, any> {
  const recommendations: Recommendation[] = data.recommendations || [];

  if (rating > 2) {
    const filtered = recommendations.filter(
      (rec) => !(rec.canonical_key === canonicalKey && rec.createdBy === 'auto')
    );
    return {
      ...data,
      recommendations: filtered,
    };
  }

  if (shouldCreateAutoRecommendation(recommendations, canonicalKey, rating)) {
    const newRec = buildAutoRecommendation(canonicalKey, rating, industryKey);
    if (newRec) {
      return {
        ...data,
        recommendations: [...recommendations, newRec],
      };
    }
  }

  return data;
}
