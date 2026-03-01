# Multi-Jurisdiction Credibility + Consistency - Deliverable

## Summary

Implemented jurisdiction-aware output text across all FRA PDFs and forms. Scotland/NI/ROI outputs no longer contain England & Wales-specific references. Dutyholder section headings now reflect appropriate terminology per jurisdiction. 74 regression tests lock in consistency.

---

## Files Changed

### Core Jurisdiction Config (1 file)
**`src/lib/jurisdictions.ts`**
- Added `dutyholderHeading` and `dutyholderTerm` fields to `JurisdictionConfig` interface
- England & Wales: `dutyholderHeading: 'WHAT IS REQUIRED OF THE RESPONSIBLE PERSON'`
- Scotland: `dutyholderHeading: 'WHAT IS REQUIRED OF THE DUTY HOLDER'` (uses "duty holder" terminology)
- Northern Ireland: `dutyholderHeading: 'WHAT IS REQUIRED OF THE RESPONSIBLE PERSON'`
- Republic of Ireland: `dutyholderHeading: 'WHAT IS REQUIRED OF EMPLOYERS AND PERSONS IN CONTROL'` (updated regulatory text to use "dutyholders")

### PDF Rendering (2 files)
**`src/lib/pdf/fra/fraCoreDraw.ts`**
- `drawResponsiblePersonDuties()`: Now uses `jurisdictionConfig.dutyholderHeading` instead of hardcoded "WHAT IS REQUIRED OF THE RESPONSIBLE PERSON"

**`src/lib/pdf/buildCombinedPdf.ts`**
- Compute `dutyholderSectionHeading` early from jurisdiction config
- Pass to `drawTableOfContents()` for TOC entry
- Use in section rendering (Title Case format)
- Removed duplicate jurisdiction config declarations

### Quick Action Guardrails (1 file)
**`src/components/modules/forms/FRA2MeansOfEscapeForm.tsx`**
- Import `normalizeJurisdiction` from jurisdictions adapter
- Added `jurisdiction?: string` to Document interface
- Travel distance verification quick action now conditionally includes:
  - England & Wales: "BS 9999, Approved Document B, HTM, or sector-specific guidance"
  - Scotland/NI/ROI: "BS 9999, applicable building regulations, or sector-specific guidance"

### Tests + Config (3 files)
**`src/lib/__tests__/jurisdictions.test.ts`** (NEW)
- 74 comprehensive unit tests
- Normalization tests (legacy UK/IE/SCOT/NI mappings)
- Label tests for all 4 jurisdictions
- Config validation (required fields present)
- Regression tests: ADB exclusivity, dutyholder heading correctness

**`vitest.config.ts`** (NEW)
- Vitest configuration for test runner

**`package.json`**
- Added `vitest` dependency
- Added `test` and `test:watch` scripts

---

## Acceptance Check Results

### ✅ Approved Document B References Verified
```bash
$ rg -n "Approved Document B" src
```

**Legitimate occurrences (jurisdiction-appropriate):**
- `src/lib/jurisdictions.ts:34` - England & Wales config only
- `src/components/modules/forms/FRA2MeansOfEscapeForm.tsx:260` - Conditional (EW only)
- `src/components/modules/forms/A1DocumentControlForm.tsx:42` - Standards selection list
- `src/components/documents/CreateDocumentModal.tsx:61` - Standards selection list
- `src/components/modules/forms/FSD*Form.tsx` - FSD forms (design basis selection)
- `src/lib/fsd/fsdConsistencyEngine.ts:198` - FSD consistency check (EW-specific)
- `src/lib/reportText/fsd/purposeAndScope.ts:9` - FSD report text (EW-specific)
- `src/lib/__tests__/jurisdictions.test.ts` - Tests verifying ADB exclusivity

**Result:** ✅ No ADB references in non-EW output generation paths

### ✅ Unit Tests Pass
```bash
$ npm test

 ✓ src/lib/__tests__/jurisdictions.test.ts  (74 tests) 62ms

 Test Files  1 passed (1)
      Tests  74 passed (74)
```

### ✅ Build Success
```bash
$ npm run build

✓ built in 20.24s
```

---

## Test Coverage Breakdown

**Normalization (23 tests):**
- Direct canonical values: england_wales, scotland, northern_ireland, ireland
- Legacy mappings: UK → england_wales, IE → ireland, SCOT → scotland, NI → northern_ireland
- Null/undefined/empty defaults to england_wales
- Unrecognized values default to england_wales

**Labels (7 tests):**
- Correct labels for all 4 jurisdictions
- Legacy value normalization + label retrieval

**Configuration (28 tests):**
- England & Wales: FSO, ADB, responsible person terminology
- Scotland: Fire (Scotland) Act, duty holder terminology, no ADB
- Northern Ireland: NI-specific legislation, responsible person, no ADB
- Ireland: Irish legislation, employer/person in control terminology, no ADB, TGD-B reference

**Regression (9 tests):**
- Regulatory framework text starts correctly per jurisdiction
- Scotland heading doesn't say "Responsible Person"
- Ireland uses neutral dutyholder terminology
- Only England & Wales references ADB in primary legislation

**Utilities (7 tests):**
- Available jurisdictions list correct

---

## Output Examples

### PDF Section Heading (FRA Dutyholder Duties)

| Jurisdiction | Heading |
|--------------|---------|
| England & Wales | `WHAT IS REQUIRED OF THE RESPONSIBLE PERSON` |
| Scotland | `WHAT IS REQUIRED OF THE DUTY HOLDER` |
| Northern Ireland | `WHAT IS REQUIRED OF THE RESPONSIBLE PERSON` |
| Republic of Ireland | `WHAT IS REQUIRED OF EMPLOYERS AND PERSONS IN CONTROL` |

### Combined PDF TOC Entry

| Jurisdiction | TOC Entry |
|--------------|-----------|
| England & Wales | `What Is Required Of The Responsible Person` |
| Scotland | `What Is Required Of The Duty Holder` |
| Republic of Ireland | `What Is Required Of Employers And Persons In Control` |

### Quick Action Text (Travel Distances)

**England & Wales:**
> Verify travel distances against appropriate standards (BS 9999, **Approved Document B**, HTM, or sector-specific guidance)...

**Scotland/NI/ROI:**
> Verify travel distances against appropriate standards (BS 9999, **applicable building regulations**, or sector-specific guidance)...

---

## No Module/Scoring Changes ✅

**Confirmed unchanged:**
- Module schemas (A1, A2, FRA1-5, etc.)
- Captured answer field names
- Scoring engines (FRA, DSEAR, FSD, RE)
- Database structure
- Module instance data

**Only changed:**
- Output text composition
- PDF section headings
- Quick action wording
- Tests

---

## Backward Compatibility ✅

- Existing documents with `jurisdiction: null` → Default to England & Wales
- Legacy values `'UK'`, `'IE'` automatically normalized at render time
- No database migration required
- No data transformation needed

---

## Verification Commands

```bash
# Run tests
npm test

# Build project
npm run build

# Check for ADB references
rg -n "Approved Document B" src

# Run tests in watch mode
npm run test:watch
```

---

## Files Modified (Summary)

```
MODIFIED:
  src/lib/jurisdictions.ts                              (+18 lines: dutyholderHeading, dutyholderTerm fields)
  src/lib/pdf/fra/fraCoreDraw.ts                        (+3 -1: jurisdiction-aware heading)
  src/lib/pdf/buildCombinedPdf.ts                       (+17 -4: TOC + section heading awareness)
  src/components/modules/forms/FRA2MeansOfEscapeForm.tsx (+15 -3: conditional ADB reference)
  package.json                                          (+3: vitest + test scripts)

CREATED:
  src/lib/__tests__/jurisdictions.test.ts               (+406 lines: 74 tests)
  vitest.config.ts                                      (+7 lines: test config)
  MULTI_JURISDICTION_CREDIBILITY_AND_CONSISTENCY_COMPLETE.md  (full documentation)
  MULTI_JURISDICTION_DELIVERABLE.md                     (this file)

Total: 7 files modified, 4 files created
```

---

## Conclusion

✅ **All four phases complete:**
1. Jurisdiction adapter content tightened with dutyholder headings/terms
2. PDF headings/labels now jurisdiction-aware
3. Quick action text conditionally excludes ADB for non-EW jurisdictions
4. 74 regression tests prevent future drift

✅ **All acceptance checks pass:**
- ADB references only in legitimate EW-specific paths
- Tests pass (74/74)
- Build succeeds
- No module/schema changes
- Fully backward compatible

The system now generates professional, jurisdiction-appropriate outputs for all four legal regimes.
