# Survey Framework Architecture

## Overview

ClearRisk is now built as a **multi-framework survey platform** that can support different risk assessment methodologies without requiring code duplication or separate applications.

## Core Concept

Instead of building separate apps for Fire Property, FRA, and ATEX surveys, we use a **framework-agnostic architecture** where different survey types are configurations, not separate products.

## Supported Frameworks

### Currently Active
- **Fire Property Risk Survey** (`fire_property`) - Fully implemented with complete forms and logic

### Coming Soon
- **Fire Risk Assessment** (`fire_risk_assessment`) - FRA surveys (UI placeholder ready)
- **ATEX / DSEAR** (`atex`) - ATEX/DSEAR surveys (UI placeholder ready)

## Database Schema

### survey_reports table
- `framework_type` (text): Identifies which framework this survey uses
  - `fire_property`: Fire Property Risk Survey (current/default)
  - `fire_risk_assessment`: Fire Risk Assessment (FRA) - Coming Soon
  - `atex`: ATEX / DSEAR - Coming Soon
- `survey_type` (text): Full or Abridged
- All other fields remain framework-agnostic

### survey_sections table
New table for tracking section completion across frameworks:
- `survey_id`: Foreign key to survey_reports
- `section_code`: Standardized section identifier (e.g., FP_01_Location, AT_02_IgnitionSources)
- `section_complete`: Boolean completion status
- Enables framework-specific section tracking

## Section Code Convention

All sections follow this naming pattern: `[Framework]_[Number]_[Name]`

**Framework Prefixes:**
- FP = Fire Property
- FR = Fire Risk Assessment
- AT = ATEX

**Examples:**
- `FP_01_Location` - Fire Property: Location & Occupancy
- `FP_06_FireProtection` - Fire Property: Fire Protection Systems
- `AT_01_Zoning` - ATEX: Hazardous Area Zoning
- `FR_02_FireHazards` - FRA: Fire Hazards

## File Structure

### /src/utils/sectionCodes.ts
Central registry of all section definitions for each framework. Defines:
- Section codes
- Section names
- Which sections are required
- Which sections are available in abridged surveys

**Usage:**
```typescript
import { getSectionsByFramework } from '@/utils/sectionCodes';

const sections = getSectionsByFramework('fire_property', 'Full');
```

### /src/utils/reportGenerator.ts
Updated to generate framework-specific report titles and content based on `frameworkType`.

## UI Components

### Dashboard (Dashboard.tsx)
- Shows framework type in table
- Framework filter dropdown
- Resurvey preserves framework type

### New Survey Modal (NewSurveyModal.tsx)
- Framework selection dropdown (first field)
- Active: Fire Property Risk Survey
- Coming Soon (disabled): Fire Risk Assessment (FRA), ATEX / DSEAR
- Defaults to Fire Property

## Current State (Phase 1)

**Implemented:**
- Database schema with framework support
- Section tracking infrastructure
- Framework selection in UI (with coming soon indicators)
- Framework filtering in dashboard
- Framework-aware report generation

**Only Fire Property is fully implemented** with complete forms and logic. FRA and ATEX have the database structure and UI placeholders but no form implementations yet.

## Next Steps (Phase 2)

When adding a new framework (e.g., ATEX or FRA):

1. Remove the "disabled" attribute in NewSurveyModal.tsx for that framework
2. Add section definitions to `sectionCodes.ts` (already exists for FRA and ATEX)
3. Create framework-specific form components
4. Add framework-specific calculation logic
5. Update report templates for new framework
6. Add framework-specific recommendation templates

**DO NOT:**
- Create separate apps
- Duplicate auth/dashboard code
- Fork the database

## Key Benefits

This architecture enables:
- Single codebase for all frameworks
- Shared authentication and user management
- Unified dashboard experience
- Easy addition of new frameworks
- Framework-specific business logic when needed
- Consistent data model across frameworks

## Migration History

- `20260112183343_add_framework_architecture.sql`: Added framework_type and survey_sections table
