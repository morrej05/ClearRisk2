// src/lib/fra/complexityEngine.ts

export type FraComplexityBand = "Low" | "Moderate" | "High" | "VeryHigh";

export type StoreysBand =
  | "1"
  | "2"
  | "3"
  | "4"
  | "5-6"
  | "7-10"
  | "11+"
  | "unknown"
  | "custom";

export type FloorAreaBand =
  | "<150"
  | "150-300"
  | "300-1000"
  | "1000-5000"
  | "5000-10000"
  | "10000+"
  | "unknown"
  | "custom";

export interface FraBuildingComplexityInput {
  storeys?: number | null;
  floorAreaM2?: number | null;
  storeysBand?: StoreysBand | string | null;
  storeysExact?: number | string | null;
  floorAreaBand?: FloorAreaBand | string | null;
  floorAreaM2Exact?: number | string | null;
  // "sleeping risk" is building/assessment-wide; keep it simple
  sleepingRisk?: "None" | "HMO" | "BlockOrHotel" | "Vulnerable";
  layoutComplexity?: "Simple" | "Moderate" | "Complex" | "MixedUse";
  fireProtectionReliance?:
    | "Basic"
    | "DetectionAndEmergencyLighting"
    | "CompartmentationCritical"
    | "EngineeredSystemsCritical";
}

export interface FraSCSResult {
  score: number;
  band: FraComplexityBand;
  breakdown: {
    height: number;
    area: number;
    sleeping: number;
    layout: number;
    reliance: number;
  };
}

export function deriveStoreysForScoring(params: {
  storeysBand?: StoreysBand | string | null;
  storeysExact?: number | string | null;
}): number {
  const exactRaw = params.storeysExact;
  const exact = typeof exactRaw === 'number' ? exactRaw : (typeof exactRaw === 'string' && exactRaw ? parseFloat(exactRaw) : null);
  const band = (params.storeysBand ?? null) as string | null;

  if (band === "custom" && typeof exact === "number" && exact > 0 && !isNaN(exact)) {
    return exact;
  }

  switch (band) {
    case "1":
      return 1;
    case "2":
      return 2;
    case "3":
      return 3;
    case "4":
      return 4;
    case "5-6":
      return 6;
    case "7-10":
      return 10;
    case "11+":
      return 11;
    case "unknown":
      return 4;
    default:
      if (typeof exact === "number" && exact > 0 && !isNaN(exact)) {
        return exact;
      }
      return 4;
  }
}

export function deriveFloorAreaM2ForScoring(params: {
  floorAreaBand?: FloorAreaBand | string | null;
  floorAreaM2?: number | string | null;
  floorAreaM2Exact?: number | string | null;
}): number {
  const exactRaw = params.floorAreaM2Exact ?? params.floorAreaM2;
  const exact = typeof exactRaw === 'number' ? exactRaw : (typeof exactRaw === 'string' && exactRaw ? parseFloat(exactRaw) : null);
  const band = (params.floorAreaBand ?? null) as string | null;

  if (band === "custom" && typeof exact === "number" && exact > 0 && !isNaN(exact)) {
    return exact;
  }

  switch (band) {
    case "<150":
      return 150;
    case "150-300":
      return 300;
    case "300-1000":
      return 1000;
    case "1000-5000":
      return 5000;
    case "5000-10000":
      return 10000;
    case "10000+":
      return 10000;
    case "unknown":
      return 1000;
    default:
      if (typeof exact === "number" && exact > 0 && !isNaN(exact)) {
        return exact;
      }
      return 1000;
  }
}

function scoreHeight(storeys?: number | null): number {
  const s = storeys ?? 0;
  if (s <= 2) return 1;
  if (s <= 4) return 2;
  if (s <= 6) return 3;
  return 4;
}

function scoreArea(m2?: number | null): number {
  const a = m2 ?? 0;
  if (a < 300) return 1;
  if (a < 1000) return 2;
  if (a < 5000) return 3;
  return 4;
}

function scoreSleeping(risk?: FraBuildingComplexityInput["sleepingRisk"]): number {
  switch (risk) {
    case "HMO":
      return 2;
    case "BlockOrHotel":
      return 3;
    case "Vulnerable":
      return 4;
    case "None":
    default:
      return 0;
  }
}

function scoreLayout(l?: FraBuildingComplexityInput["layoutComplexity"]): number {
  switch (l) {
    case "Moderate":
      return 2;
    case "Complex":
      return 3;
    case "MixedUse":
      return 4;
    case "Simple":
    default:
      return 1;
  }
}

function scoreProtectionReliance(r?: FraBuildingComplexityInput["fireProtectionReliance"]): number {
  switch (r) {
    case "DetectionAndEmergencyLighting":
      return 2;
    case "CompartmentationCritical":
      return 3;
    case "EngineeredSystemsCritical":
      return 4;
    case "Basic":
    default:
      return 1;
  }
}

export function calculateSCS(input: FraBuildingComplexityInput): FraSCSResult {
  const storeysForScoring = deriveStoreysForScoring({
    storeysBand: input.storeysBand,
    storeysExact: input.storeysExact ?? input.storeys
  });

  const areaForScoring = deriveFloorAreaM2ForScoring({
    floorAreaBand: input.floorAreaBand,
    floorAreaM2: input.floorAreaM2,
    floorAreaM2Exact: input.floorAreaM2Exact
  });

  const height = scoreHeight(storeysForScoring);
  const area = scoreArea(areaForScoring);
  const sleeping = scoreSleeping(input.sleepingRisk);
  const layout = scoreLayout(input.layoutComplexity);
  const reliance = scoreProtectionReliance(input.fireProtectionReliance);

  const score = height + area + sleeping + layout + reliance;

  let band: FraComplexityBand = "Low";
  if (score >= 18) band = "VeryHigh";
  else if (score >= 14) band = "High";
  else if (score >= 9) band = "Moderate";

  return { score, band, breakdown: { height, area, sleeping, layout, reliance } };
}

export interface FireProtectionModuleData {
  hasDetectionSystem?: boolean;
  hasEmergencyLighting?: boolean;
  hasSuppressionSystem?: boolean;
  hasSmokeControl?: boolean;
  compartmentationCritical?: boolean;
  engineeredEvacuationStrategy?: boolean;
}

export function deriveFireProtectionReliance(
  protectionData?: FireProtectionModuleData
): FraBuildingComplexityInput["fireProtectionReliance"] {
  if (!protectionData) return "Basic";

  const hasEngineered =
    protectionData.hasSuppressionSystem ||
    protectionData.hasSmokeControl ||
    protectionData.engineeredEvacuationStrategy;

  if (hasEngineered) {
    return "EngineeredSystemsCritical";
  }

  if (protectionData.compartmentationCritical) {
    return "CompartmentationCritical";
  }

  if (protectionData.hasDetectionSystem && protectionData.hasEmergencyLighting) {
    return "DetectionAndEmergencyLighting";
  }

  return "Basic";
}
