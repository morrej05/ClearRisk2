interface Hazard {
  id: string;
  title: string;
  description: string;
  rating: string;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  hazard: string;
  status: string;
  isCritical: boolean;
}

interface UploadedFile {
  id: string;
  name: string;
  url: string;
  type: 'photo' | 'site-plan';
}

interface BuildingConstruction {
  heavy_non_combustible_pct: number;
  light_non_combustible_pct: number;
  foam_plastic_approved_pct: number;
  foam_plastic_unapproved_pct: number;
  other_combustible_pct: number;
}

interface Building {
  id: string;
  building_name: string;
  year_built: string;
  building_frame: string;
  number_of_floors: string;
  building_height_m: string;
  floor_area_sqm: string;
  roof_area_sqm: string;
  construction: {
    walls: BuildingConstruction;
    roof_ceiling: BuildingConstruction;
  };
  fire_protection: {
    sprinkler_coverage_pct: number;
    detection_coverage_pct: number;
  };
  construction_description: string;
}

interface FormData {
  propertyName: string;
  propertyAddress: string;
  primaryOccupancy: string;
  discussionsOnSite: string;
  buildings: Building[];
  activityOverview: string;
  fireProtectionDescription: string;
  inspectionDate: string;
  surveyScopeVisual: boolean;
  surveyScopeNonIntrusive: boolean;
  surveyScopeLimitedAreas: boolean;
  surveyScopeDesktopReview: boolean;
  surveyScopeOther: boolean;
  surveyScopeOtherText: string;
  areasInspected: string;
  areasNotInspected: string;
  companySiteBackground: string;
  occupancyProductsServices: string;
  employeesOperatingHours: string;
  commitmentLossPrevention: string;
  fireEquipmentTesting: string;
  controlHotWork: string;
  electricalMaintenance: string;
  generalMaintenance: string;
  selfInspections: string;
  changeManagement: string;
  contractorControls: string;
  impairmentHandling: string;
  smokingControls: string;
  fireSafetyHousekeeping: string;
  emergencyResponse: string;
  fixedFireProtectionSystems: string;
  fireDetectionAlarmSystems: string;
  waterSupplies: string;
  businessInterruption: string;
  profitGeneration: string;
  interdependencies: string;
  bcp: string;
  allowGenerateDraftRecommendations: boolean;
  reviewerName: string;
  reviewerEmail: string;
  reportStatus: 'Draft' | 'Internally Reviewed' | 'Issue Ready';
  surveyType?: 'Full' | 'Abridged';
  frameworkType?: 'fire_property' | 'fire_risk_assessment' | 'atex';
  industrySector?: string;
  constructionScore?: number;
  fireProtectionScore?: number;
  detectionScore?: number;
  managementScore?: number;
  specialHazardsScore?: number;
  businessInterruptionScore?: number;
  wConstruction?: number;
  wProtection?: number;
  wDetection?: number;
  wManagement?: number;
  wHazards?: number;
  wBi?: number;
  overallRiskScore?: number;
  riskBand?: string;
}

export type SectionId =
  | 'SECTION_1'
  | 'SECTION_2'
  | 'SECTION_3'
  | 'SECTION_4'
  | 'SECTION_5'
  | 'SECTION_6'
  | 'SECTION_7'
  | 'SECTION_8'
  | 'SECTION_9'
  | 'SECTION_10'
  | 'SECTION_11'
  | 'SECTION_12'
  | 'SECTION_13'
  | 'SECTION_14';

export interface ReportSection {
  id: SectionId;
  title: string;
  content: string;
}

export interface GeneratedReport {
  sections: ReportSection[];
  fullText: string;
}

export const SECTION_TITLES: Record<SectionId, string> = {
  SECTION_1: 'Introduction & Survey Scope',
  SECTION_2: 'Location & Property Description',
  SECTION_3: 'Construction & Layout',
  SECTION_4: 'Occupancy & Operations',
  SECTION_5: 'Management Systems',
  SECTION_6: 'Fire Protection & Loss Prevention',
  SECTION_7: 'Hazards & Deficiencies',
  SECTION_8: 'Business Interruption Exposure',
  SECTION_9: 'Existing Risk Controls',
  SECTION_10: 'Natural Hazards',
  SECTION_11: 'Recommendations',
  SECTION_12: 'Attachments',
  SECTION_13: 'Overall Risk Commentary',
  SECTION_14: 'Disclaimer',
};

function formatDate(dateString: string): string {
  if (!dateString) return 'not confirmed at the time of survey';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function notProvided(value: string | undefined): string {
  return value && value.trim() ? value : 'not confirmed at the time of survey';
}

function getScopeText(formData: FormData): string {
  const items: string[] = [];
  if (formData.surveyScopeVisual) items.push('visual inspection');
  if (formData.surveyScopeNonIntrusive) items.push('non-intrusive testing');
  if (formData.surveyScopeLimitedAreas) items.push('limited access areas');
  if (formData.surveyScopeDesktopReview) items.push('desktop review of documentation');
  if (formData.surveyScopeOther && formData.surveyScopeOtherText) items.push(formData.surveyScopeOtherText);

  if (items.length === 0) return 'The scope of the survey was not confirmed at the time of inspection.';
  return `The survey comprised ${items.join(', ')}.`;
}

export function generateSection(
  sectionId: SectionId,
  formData: FormData,
  hazards: Hazard[],
  recommendations: Recommendation[],
  uploadedFiles: UploadedFile[]
): ReportSection {
  const photos = uploadedFiles.filter(f => f.type === 'photo');
  const sitePlans = uploadedFiles.filter(f => f.type === 'site-plan');
  const filledHazards = hazards.filter(h => h.title || h.description);
  const filledRecommendations = recommendations.filter(r => r.title || r.description);

  let content = '';
  const title = SECTION_TITLES[sectionId];

  switch (sectionId) {
    case 'SECTION_1':
      content = `Inspection Date: ${formatDate(formData.inspectionDate)}\n\n`;

      if (formData.discussionsOnSite) {
        content += `Discussions on Site: The survey was conducted with input from ${formData.discussionsOnSite}.\n\n`;
      }

      content += `Survey Scope and Methodology:\n${getScopeText(formData)}\n\n`;

      if (formData.areasInspected) {
        content += `The following areas were inspected during the survey: ${formData.areasInspected}\n\n`;
      }

      if (formData.areasNotInspected) {
        content += `Areas Not Inspected / Limitations: ${formData.areasNotInspected}\n\n`;
      }
      break;

    case 'SECTION_2':
      content = `Property Name: ${notProvided(formData.propertyName)}\n\n`;
      content += `Property Address: ${notProvided(formData.propertyAddress)}\n\n`;
      content += `Primary Occupancy: ${notProvided(formData.primaryOccupancy)}\n\n`;

      if (formData.companySiteBackground) {
        content += `Company and Site Background:\n${formData.companySiteBackground}\n\n`;
      }
      break;

    case 'SECTION_3':
      if (formData.buildings && formData.buildings.length > 0) {
        formData.buildings.forEach((building, index) => {
          if (formData.buildings.length > 1) {
            content += `Building ${index + 1}: ${building.building_name || 'Unnamed Building'}\n\n`;
          } else if (building.building_name) {
            content += `Building Name: ${building.building_name}\n\n`;
          }

          if (building.year_built) {
            content += `Year Built: ${building.year_built}\n`;
          }
          if (building.building_frame) {
            content += `Building Frame: ${building.building_frame}\n`;
          }
          if (building.number_of_floors) {
            content += `Number of Floors: ${building.number_of_floors}\n`;
          }
          if (building.building_height_m) {
            content += `Building Height: ${building.building_height_m}m\n`;
          }
          if (building.floor_area_sqm) {
            content += `Floor Area: ${building.floor_area_sqm} sqm\n`;
          }
          if (building.roof_area_sqm) {
            content += `Roof Area: ${building.roof_area_sqm} sqm\n`;
          }
          content += `\n`;

          const wallsTotal = building.construction.walls.heavy_non_combustible_pct +
                           building.construction.walls.light_non_combustible_pct +
                           building.construction.walls.foam_plastic_approved_pct +
                           building.construction.walls.foam_plastic_unapproved_pct +
                           building.construction.walls.other_combustible_pct;

          if (wallsTotal > 0) {
            content += `Wall Construction:\n`;
            if (building.construction.walls.heavy_non_combustible_pct > 0) {
              content += `  Heavy Non-Combustible: ${building.construction.walls.heavy_non_combustible_pct}%\n`;
            }
            if (building.construction.walls.light_non_combustible_pct > 0) {
              content += `  Light Non-Combustible: ${building.construction.walls.light_non_combustible_pct}%\n`;
            }
            if (building.construction.walls.foam_plastic_approved_pct > 0) {
              content += `  Foam/Plastic (Approved): ${building.construction.walls.foam_plastic_approved_pct}%\n`;
            }
            if (building.construction.walls.foam_plastic_unapproved_pct > 0) {
              content += `  Foam/Plastic (Unapproved): ${building.construction.walls.foam_plastic_unapproved_pct}%\n`;
            }
            if (building.construction.walls.other_combustible_pct > 0) {
              content += `  Other Combustible: ${building.construction.walls.other_combustible_pct}%\n`;
            }
            content += `\n`;
          }

          const roofTotal = building.construction.roof_ceiling.heavy_non_combustible_pct +
                          building.construction.roof_ceiling.light_non_combustible_pct +
                          building.construction.roof_ceiling.foam_plastic_approved_pct +
                          building.construction.roof_ceiling.foam_plastic_unapproved_pct +
                          building.construction.roof_ceiling.other_combustible_pct;

          if (roofTotal > 0) {
            content += `Roof/Ceiling Construction:\n`;
            if (building.construction.roof_ceiling.heavy_non_combustible_pct > 0) {
              content += `  Heavy Non-Combustible: ${building.construction.roof_ceiling.heavy_non_combustible_pct}%\n`;
            }
            if (building.construction.roof_ceiling.light_non_combustible_pct > 0) {
              content += `  Light Non-Combustible: ${building.construction.roof_ceiling.light_non_combustible_pct}%\n`;
            }
            if (building.construction.roof_ceiling.foam_plastic_approved_pct > 0) {
              content += `  Foam/Plastic (Approved): ${building.construction.roof_ceiling.foam_plastic_approved_pct}%\n`;
            }
            if (building.construction.roof_ceiling.foam_plastic_unapproved_pct > 0) {
              content += `  Foam/Plastic (Unapproved): ${building.construction.roof_ceiling.foam_plastic_unapproved_pct}%\n`;
            }
            if (building.construction.roof_ceiling.other_combustible_pct > 0) {
              content += `  Other Combustible: ${building.construction.roof_ceiling.other_combustible_pct}%\n`;
            }
            content += `\n`;
          }

          if (building.fire_protection.sprinkler_coverage_pct > 0 || building.fire_protection.detection_coverage_pct > 0) {
            content += `Fire Protection Coverage:\n`;
            if (building.fire_protection.sprinkler_coverage_pct > 0) {
              content += `  Sprinkler Coverage: ${building.fire_protection.sprinkler_coverage_pct}%\n`;
            }
            if (building.fire_protection.detection_coverage_pct > 0) {
              content += `  Detection Coverage: ${building.fire_protection.detection_coverage_pct}%\n`;
            }
            content += `\n`;
          }

          if (building.construction_description) {
            content += `Construction Description:\n${building.construction_description}\n\n`;
          }

          if (index < formData.buildings.length - 1) {
            content += `---\n\n`;
          }
        });
      } else {
        content += `Building information was not provided at the time of survey.\n\n`;
      }
      break;

    case 'SECTION_4':
      if (formData.occupancyProductsServices) {
        content += `Occupancy, Products and Services:\n${formData.occupancyProductsServices}\n\n`;
      }

      if (formData.activityOverview) {
        content += `Activity Overview:\n${formData.activityOverview}\n\n`;
      }

      if (formData.employeesOperatingHours) {
        content += `Employees and Operating Hours:\n${formData.employeesOperatingHours}\n\n`;
      }

      if (!formData.occupancyProductsServices && !formData.activityOverview && !formData.employeesOperatingHours) {
        content += `Detailed occupancy information was not confirmed at the time of survey.\n\n`;
      }
      break;

    case 'SECTION_5':
      if (formData.commitmentLossPrevention) {
        content += `Commitment to Loss Prevention:\n${formData.commitmentLossPrevention}\n\n`;
      }

      const hasMaintenanceInfo = formData.fireEquipmentTesting || formData.electricalMaintenance || formData.generalMaintenance;
      if (hasMaintenanceInfo) {
        content += `Maintenance and Testing Programs:\n`;
        if (formData.fireEquipmentTesting) {
          content += `\nFire Equipment Testing: ${formData.fireEquipmentTesting}\n`;
        }
        if (formData.electricalMaintenance) {
          content += `\nElectrical Maintenance: ${formData.electricalMaintenance}\n`;
        }
        if (formData.generalMaintenance) {
          content += `\nGeneral Maintenance: ${formData.generalMaintenance}\n`;
        }
        content += `\n`;
      }

      const hasControlsInfo = formData.controlHotWork || formData.smokingControls || formData.contractorControls ||
                              formData.changeManagement || formData.selfInspections || formData.impairmentHandling;

      if (hasControlsInfo) {
        content += `Safety Controls and Procedures:\n`;
        if (formData.controlHotWork) {
          content += `\nHot Work Controls: ${formData.controlHotWork}\n`;
        }
        if (formData.smokingControls) {
          content += `\nSmoking Controls: ${formData.smokingControls}\n`;
        }
        if (formData.contractorControls) {
          content += `\nContractor Controls: ${formData.contractorControls}\n`;
        }
        if (formData.changeManagement) {
          content += `\nChange Management: ${formData.changeManagement}\n`;
        }
        if (formData.selfInspections) {
          content += `\nSelf Inspections: ${formData.selfInspections}\n`;
        }
        if (formData.impairmentHandling) {
          content += `\nImpairment Handling: ${formData.impairmentHandling}\n`;
        }
        content += `\n`;
      }

      if (formData.fireSafetyHousekeeping) {
        content += `Fire Safety and Housekeeping:\n${formData.fireSafetyHousekeeping}\n\n`;
      }

      if (formData.emergencyResponse) {
        content += `Emergency Response:\n${formData.emergencyResponse}\n\n`;
      }

      if (!hasMaintenanceInfo && !hasControlsInfo && !formData.commitmentLossPrevention &&
          !formData.fireSafetyHousekeeping && !formData.emergencyResponse) {
        content += `Management system information was not confirmed at the time of survey.\n\n`;
      }
      break;

    case 'SECTION_6':
      if (formData.fireProtectionDescription) {
        content += `Overview:\n${formData.fireProtectionDescription}\n\n`;
      }

      if (formData.fixedFireProtectionSystems) {
        content += `Fixed Fire Protection Systems:\n${formData.fixedFireProtectionSystems}\n\n`;
      }

      if (formData.fireDetectionAlarmSystems) {
        content += `Fire Detection and Alarm Systems:\n${formData.fireDetectionAlarmSystems}\n\n`;
      }

      if (formData.waterSupplies) {
        content += `Water Supplies:\n${formData.waterSupplies}\n\n`;
      }

      if (!formData.fireProtectionDescription && !formData.fixedFireProtectionSystems &&
          !formData.fireDetectionAlarmSystems && !formData.waterSupplies) {
        content += `Fire protection system details were not confirmed at the time of survey.\n\n`;
      }
      break;

    case 'SECTION_7':
      if (filledHazards.length > 0) {
        content += `During the survey, the following hazards and deficiencies were noted:\n\n`;
        filledHazards.forEach((hazard, index) => {
          content += `${index + 1}. ${hazard.title || 'Hazard'}`;
          if (hazard.rating) {
            content += ` [${hazard.rating.toUpperCase()} RISK]`;
          }
          content += `\n`;
          if (hazard.description) {
            content += `${hazard.description}\n`;
          }
          content += `\n`;
        });
      } else {
        content += `No specific hazards or deficiencies were documented at the time of survey. This does not confirm absence of hazards, only that none were recorded during the inspection.\n\n`;
      }
      break;

    case 'SECTION_8':
      if (formData.businessInterruption) {
        content += `Business Interruption Considerations:\n${formData.businessInterruption}\n\n`;
      }

      if (formData.profitGeneration) {
        content += `Profit Generation:\n${formData.profitGeneration}\n\n`;
      }

      if (formData.interdependencies) {
        content += `Interdependencies:\n${formData.interdependencies}\n\n`;
      }

      if (formData.bcp) {
        content += `Business Continuity Planning:\n${formData.bcp}\n\n`;
      }

      if (!formData.businessInterruption && !formData.profitGeneration &&
          !formData.interdependencies && !formData.bcp) {
        content += `Business continuity information was not confirmed at the time of survey.\n\n`;
      }
      break;

    case 'SECTION_9':
      content += `Based on observations made during the survey, the following risk controls appear to be in place:\n\n`;

      const controls: string[] = [];

      if (formData.fireProtectionDescription) {
        controls.push(`Fire protection measures as described in Section 6 appear to be installed.`);
      }

      if (formData.commitmentLossPrevention) {
        controls.push(`Management demonstrates awareness of loss prevention principles.`);
      }

      if (formData.fireEquipmentTesting || formData.electricalMaintenance || formData.generalMaintenance) {
        controls.push(`Maintenance and testing programs appear to be established.`);
      }

      if (controls.length > 0) {
        controls.forEach((control, index) => {
          content += `${index + 1}. ${control}\n`;
        });
        content += `\n`;
      } else {
        content += `Detailed information regarding existing risk controls was not confirmed at the time of survey.\n\n`;
      }

      content += `The above observations are based on information available at the time of survey and should not be interpreted as confirmation of compliance with any standard or regulation.\n\n`;
      break;

    case 'SECTION_10':
      // Natural Hazards
      const naturalHazards = (formData as any).natural_hazards || [];

      if (naturalHazards.length > 0) {
        content += `The following natural hazards have been identified or considered for this location:\n\n`;

        naturalHazards.forEach((hazard: any, index: number) => {
          content += `${index + 1}. `;

          // Map hazard type to readable name
          const hazardTypeMap: Record<string, string> = {
            'river_flooding': 'River Flooding',
            'surface_water_flooding': 'Surface Water Flooding',
            'earthquake': 'Earthquake',
            'windstorm': 'Windstorm',
            'other': 'Other Natural Hazard'
          };

          content += hazardTypeMap[hazard.hazardType] || 'Natural Hazard';
          content += `\n`;

          if (hazard.description) {
            content += `   ${hazard.description}\n`;
          }
          content += `\n`;
        });

        content += `The above natural hazard information is based on available data at the time of survey. Detailed flood mapping, seismic assessments, or other specialized natural hazard studies may be required for comprehensive risk evaluation.\n\n`;
      } else {
        content += `No specific natural hazards were identified or recorded at the time of survey. This does not constitute confirmation that natural hazards do not exist. Site-specific natural hazard assessments should be conducted by appropriate specialists where required.\n\n`;
      }
      break;

    case 'SECTION_11':
      if (filledRecommendations.length > 0) {
        content += `Based on the information available, the following recommendations are provided for consideration:\n\n`;
        filledRecommendations.forEach((rec, index) => {
          content += `${index + 1}. ${rec.title || 'Recommendation'}`;
          if (rec.isCritical) {
            content += ` [CRITICAL]`;
          }
          if (rec.status) {
            content += ` [Status: ${rec.status}]`;
          }
          content += `\n`;
          if (rec.hazard) {
            content += `Related to: ${rec.hazard}\n`;
          }
          if (rec.description) {
            content += `${rec.description}\n`;
          }
          content += `\n`;
        });
        content += `These recommendations are advisory only and should be reviewed by a competent professional before implementation.\n\n`;
      } else {
        content += `No specific recommendations were generated at the time of survey based on available information.\n\n`;
      }
      break;

    case 'SECTION_12':
      if (sitePlans.length > 0 || photos.length > 0) {
        content += `The following attachments support this survey report:\n\n`;

        if (sitePlans.length > 0) {
          content += `Site Plans:\n`;
          sitePlans.forEach((file, index) => {
            content += `${index + 1}. ${file.name}\n`;
          });
          content += `\n`;
        }

        if (photos.length > 0) {
          content += `Photographs:\n`;
          photos.forEach((file, index) => {
            content += `${index + 1}. ${file.name}\n`;
          });
          content += `\n`;
        }

        content += `All attachments should be reviewed in conjunction with this report.\n\n`;
      } else {
        content += `No attachments were provided with this survey report.\n\n`;
      }
      break;

    case 'SECTION_13':
      content += `This survey was conducted to provide an overview of fire and property risk at the above premises. Based on the information gathered during the inspection, the following summary observations are offered:\n\n`;

      if (formData.industrySector && formData.overallRiskScore && formData.riskBand) {
        content += `OVERALL RISK SCORE: ${formData.overallRiskScore} (${formData.riskBand})\n\n`;

        content += `This score has been calculated using sector-adjusted weightings appropriate to a ${formData.industrySector} occupancy. `;

        const sectorDescriptions: Record<string, string> = {
          'Food & Beverage': 'Food processing and storage occupancies are historically associated with severe fire losses driven by combustible construction, insulated panels, ceiling void fire spread, and smoke contamination. As such, construction materials and fire protection coverage are weighted more heavily in the overall risk score.',
          'Foundry / Metal': 'Foundry operations are typically characterised by non-combustible construction but elevated process hazards, including molten metal, high-energy equipment, and dependency on critical plant. Management systems and special hazards therefore carry increased weighting.',
          'Chemical / ATEX': 'Chemical manufacturing and ATEX-classified environments present elevated risks from flammable materials, explosive atmospheres, and reactive processes. Fire protection systems, management controls, and special hazard management are prioritised in the risk assessment.',
          'Logistics / Warehouse': 'Warehousing and logistics operations typically involve high-piled storage in large open spaces, making fire protection coverage and building construction critical factors. These elements are weighted most heavily in the risk score.',
          'Office / Commercial': 'Office and commercial occupancies generally present lower fire risks but may have significant business interruption exposure. The risk assessment provides balanced weighting across protection systems with emphasis on business continuity.',
          'General Industrial': 'General industrial occupancies employ balanced weighting across all risk factors, reflecting typical manufacturing environments without specific elevated hazards.',
        };

        if (sectorDescriptions[formData.industrySector]) {
          content += `${sectorDescriptions[formData.industrySector]}\n\n`;
        }

        content += `The score represents an indication of relative fire risk quality and does not predict loss frequency or severity.\n\n`;

        content += `DIMENSION BREAKDOWN:\n\n`;

        if (formData.constructionScore !== undefined && formData.wConstruction) {
          const contribution = formData.constructionScore * formData.wConstruction;
          content += `Construction & Combustibility: Score ${formData.constructionScore}, Weight ${(formData.wConstruction * 100).toFixed(0)}%, Contribution ${contribution.toFixed(1)}\n`;
        }

        if (formData.fireProtectionScore !== undefined && formData.wProtection) {
          const contribution = formData.fireProtectionScore * formData.wProtection;
          content += `Fire Protection: Score ${formData.fireProtectionScore}, Weight ${(formData.wProtection * 100).toFixed(0)}%, Contribution ${contribution.toFixed(1)}\n`;
        }

        if (formData.detectionScore !== undefined && formData.wDetection) {
          const contribution = formData.detectionScore * formData.wDetection;
          content += `Detection Systems: Score ${formData.detectionScore}, Weight ${(formData.wDetection * 100).toFixed(0)}%, Contribution ${contribution.toFixed(1)}\n`;
        }

        if (formData.managementScore !== undefined && formData.wManagement) {
          const contribution = formData.managementScore * formData.wManagement;
          content += `Management Systems: Score ${formData.managementScore}, Weight ${(formData.wManagement * 100).toFixed(0)}%, Contribution ${contribution.toFixed(1)}\n`;
        }

        if (formData.specialHazardsScore !== undefined && formData.wHazards) {
          const contribution = formData.specialHazardsScore * formData.wHazards;
          content += `Special Hazards: Score ${formData.specialHazardsScore}, Weight ${(formData.wHazards * 100).toFixed(0)}%, Contribution ${contribution.toFixed(1)}\n`;
        }

        if (formData.businessInterruptionScore !== undefined && formData.wBi) {
          const contribution = formData.businessInterruptionScore * formData.wBi;
          content += `Business Interruption: Score ${formData.businessInterruptionScore}, Weight ${(formData.wBi * 100).toFixed(0)}%, Contribution ${contribution.toFixed(1)}\n`;
        }

        content += `\n`;
      }

      const riskFactors: string[] = [];

      if (filledHazards.length > 0) {
        const highRisk = filledHazards.filter(h => h.rating === 'High').length;
        if (highRisk > 0) {
          riskFactors.push(`The survey identified ${highRisk} high-risk hazard${highRisk > 1 ? 's' : ''} requiring attention.`);
        }
      }

      if (formData.fireProtectionDescription || formData.fixedFireProtectionSystems) {
        riskFactors.push(`Fire protection systems appear to be installed, subject to ongoing maintenance and testing.`);
      }

      if (riskFactors.length > 0) {
        content += `SUMMARY OBSERVATIONS:\n\n`;
        riskFactors.forEach((factor, index) => {
          content += `${index + 1}. ${factor}\n`;
        });
        content += `\n`;
      }

      content += `This commentary is based solely on observations made during the survey visit and information provided by site representatives. It should not be regarded as a comprehensive risk assessment or guarantee of insurability.\n\n`;
      break;

    case 'SECTION_14':
      // Status-based disclaimer
      if (formData.reportStatus === 'Draft') {
        content += `This draft report has been prepared using ClearRisk as a report drafting and summarisation tool. The content is provided for review and refinement and should not be relied upon without professional verification. Final responsibility for interpretation and implementation of recommendations remains with the competent professional and duty holder.\n\n`;
      } else if (formData.reportStatus === 'Internally Reviewed') {
        content += `This report has been internally reviewed for structure, consistency and completeness. It remains a professional opinion based on information available at the time of the survey. Final responsibility for interpretation and implementation of recommendations remains with the competent professional and duty holder.\n\n`;
      } else {
        content += `This report represents a professional opinion based on observations and information available at the time of survey. It does not constitute a guarantee of loss prevention performance. Responsibility for implementation of recommendations remains with the duty holder.\n\n`;
      }

      content += `The information contained in this report is based on observations made during a survey conducted on ${formatDate(formData.inspectionDate)}. Where information has not been confirmed or provided, this has been noted within the relevant sections. The absence of specific comment should not be taken as confirmation of compliance with any standard, regulation, or code of practice.\n\n`;

      content += `All recommendations are advisory in nature and should be assessed by suitably qualified professionals before implementation. The report does not purport to identify all hazards that may be present at the premises, and ongoing management and monitoring remain the responsibility of the duty holder.\n\n`;

      if (formData.reviewerName || formData.reviewerEmail) {
        content += `Report prepared by: ${formData.reviewerName || 'Not specified'}\n`;
        if (formData.reviewerEmail) {
          content += `Contact: ${formData.reviewerEmail}\n`;
        }
        content += `\n`;
      }
      break;
  }

  return { id: sectionId, title, content };
}

export function generateReport(
  formData: FormData,
  hazards: Hazard[],
  recommendations: Recommendation[],
  uploadedFiles: UploadedFile[]
): GeneratedReport {
  const allSectionIds: SectionId[] = [
    'SECTION_1',
    'SECTION_2',
    'SECTION_3',
    'SECTION_4',
    'SECTION_5',
    'SECTION_6',
    'SECTION_7',
    'SECTION_8',
    'SECTION_9',
    'SECTION_10',
    'SECTION_11',
    'SECTION_12',
    'SECTION_13',
    'SECTION_14',
  ];

  const isAbridged = formData.surveyType === 'Abridged';
  const sectionIds = isAbridged
    ? allSectionIds.filter(id => !['SECTION_6', 'SECTION_7', 'SECTION_8', 'SECTION_9'].includes(id))
    : allSectionIds;

  const sections = sectionIds.map(id =>
    generateSection(id, formData, hazards, recommendations, uploadedFiles)
  );

  // Get framework-specific report title
  const frameworkTitles = {
    fire_property: 'PROPERTY & FIRE RISK SURVEY REPORT',
    fire_risk_assessment: 'FIRE RISK ASSESSMENT REPORT',
    atex: 'ATEX / DSEAR ASSESSMENT REPORT',
  };
  const reportTitle = frameworkTitles[formData.frameworkType || 'fire_property'];

  let fullText = `DRAFT SURVEY REPORT (AI GENERATED)

${reportTitle}${isAbridged ? ' (ABRIDGED)' : ''}

${formData.propertyName || 'Property Name Not Provided'}
${formData.propertyAddress || 'Address Not Provided'}

Report Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

${isAbridged ? `
NOTE: This abridged survey report contains a reduced set of sections relevant to the agreed scope of review.

` : ''}
`;

  sections.forEach((section, index) => {
    fullText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    fullText += `[${section.id}] ${index + 1}. ${section.title.toUpperCase()}\n\n`;
    fullText += section.content;
    fullText += `\n`;
  });

  fullText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  fullText += `END OF DRAFT REPORT\n`;

  return { sections, fullText };
}
