// src/lib/fra/complexityEngine.ts

export type FraComplexityBand = "Low" | "Moderate" | "High" | "VeryHigh";

export interface FraBuildingComplexityInput {
  storeys?: number | null;
  floorAreaM2?: number | null;
  // "sleeping risk" is building/assessment-wide; keep it simple
  sleepingRisk?: "None" | "HMO" | "BlockOrHotel" | "Vulnerable";
  layoutComplexity?: "Simple" | "Moderate" | "Complex" | "MixedUse";
}

export interface FraSCSResult {
  score: number;
  band: FraComplexityBand;
  breakdown: {
    height: number;
    area: number;
    sleeping: number;
    layout: number;
  };
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

export function calculateSCS(input: FraBuildingComplexityInput): FraSCSResult {
  const height = scoreHeight(input.storeys);
  const area = scoreArea(input.floorAreaM2);
  const sleeping = scoreSleeping(input.sleepingRisk);
  const layout = scoreLayout(input.layoutComplexity);

  const score = height + area + sleeping + layout;

  let band: FraComplexityBand = "Low";
  if (score >= 16) band = "VeryHigh";
  else if (score >= 12) band = "High";
  else if (score >= 8) band = "Moderate";

  return { score, band, breakdown: { height, area, sleeping, layout } };
}
