import type { BuildingInput } from '../re/buildingsModel';
import type { BuildingSprinklerRecord, SiteWaterRecord } from '../re/fireProtectionModel';

export type FireProtectionRecommendationContext = 'site' | 'building';
export type FireProtectionRecommendationPriority = 'high' | 'medium' | 'low';

export interface FireProtectionRecommendation {
  id: string; // deterministic
  context: FireProtectionRecommendationContext;
  priority: FireProtectionRecommendationPriority;
  title: string;
  rationale: string;
  buildingId?: string;
  buildingLabel?: string;
}

interface DeriveParams {
  siteWater: SiteWaterRecord | null;
  buildingSprinklers: BuildingSprinklerRecord[];
  buildings: BuildingInput[];
  selectedBuildingId?: string | null;
}

function asLowerString(v: unknown): string | undefined {
  return typeof v === 'string' ? v.toLowerCase() : undefined;
}

export function deriveFireProtectionRecommendations({
  siteWater,
  buildingSprinklers,
  buildings,
  selectedBuildingId,
}: DeriveParams): FireProtectionRecommendation[] {
  const recs: FireProtectionRecommendation[] = [];
  const seen = new Set<string>();

  const add = (r: FireProtectionRecommendation) => {
    if (seen.has(r.id)) return;
    seen.add(r.id);
    recs.push(r);
  };

  // SITE — reliability only (no score-based triggers)
  // NOTE: adjust field name if your SiteWaterRecord differs; FireProtectionForm references siteWaterData.water_reliability
  const reliability = asLowerString((siteWater as any)?.water_reliability);

  if (reliability === 'unreliable') {
    add({
      id: 'site:WATER_UNRELIABLE',
      context: 'site',
      priority: 'high',
      title: 'Improve fire water supply reliability',
      rationale:
        'Fire water supply is recorded as unreliable. Improve reliability and resilience supporting suppression systems.',
    });
  } else if (reliability === 'unknown') {
    add({
      id: 'site:WATER_UNKNOWN',
      context: 'site',
      priority: 'low',
      title: 'Confirm fire water supply reliability',
      rationale:
        'Fire water supply reliability is recorded as unknown. Confirm reliability using evidence of testing, redundancy, and known constraints.',
    });
  }

  // BUILDING — selected building only if provided, else all buildings
  const scoped = selectedBuildingId
    ? buildingSprinklers.filter(s => s.building_id === selectedBuildingId)
    : buildingSprinklers;

  for (const s of scoped) {
    if (!s.building_id) continue;

    const building = buildings.find(b => b.id === s.building_id);
    const label = building?.ref || building?.description || 'Building';

    const rating = (s.sprinkler_score_1_5 ?? null) as number | null;

    // These fields must match your current RE-04 data model:
    const required = (s.data as any)?.required_pct ?? null;
    const provided = (s.data as any)?.provided_pct ?? null;

    // SPRINKLER_INADEQUATE — trigger only when rating is present
    if (rating != null && rating <= 2) {
      add({
        id: `building:${s.building_id}:SPRINKLER_INADEQUATE`,
        context: 'building',
        priority: rating === 1 ? 'high' : 'medium',
        title: 'Upgrade sprinkler protection to achieve adequate protection',
        rationale: `${label}: sprinkler protection is currently rated ${rating}/5.`,
        buildingId: s.building_id,
        buildingLabel: label,
      });
    }

    // COVERAGE_GAP — trigger only when both values are present
    if (required != null && provided != null && provided < required) {
      const gap = required - provided;
      add({
        id: `building:${s.building_id}:COVERAGE_GAP`,
        context: 'building',
        priority: gap >= 30 ? 'high' : 'medium',
        title: 'Extend sprinkler coverage to meet required extent',
        rationale: `${label}: extend coverage from ${provided}% to ${required}% (${gap}% gap).`,
        buildingId: s.building_id,
        buildingLabel: label,
      });
    }
  }

  return recs;
}
