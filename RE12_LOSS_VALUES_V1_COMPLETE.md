# RE-12 Loss & Values — V1 Finalization Complete

**Status:** ✅ Complete
**Date:** 2026-02-04
**Module:** RE-12 Loss & Values

---

## Summary

RE-12 Loss & Values has been completely rebuilt to the locked v1 specification. The module now provides comprehensive sums insured tracking, worst-case loss expectancy (WLE), and normal loss expectancy (NLE) with full percentage-based calculations, expanded currency support, and transparent deterministic logic.

---

## 1. Currency Support — Expanded to 12 ISO Currencies

The following currencies are now supported:

| Code | Name                  | Symbol |
|------|-----------------------|--------|
| GBP  | British Pound         | £      |
| USD  | US Dollar             | $      |
| EUR  | Euro                  | €      |
| CAD  | Canadian Dollar       | C$     |
| AUD  | Australian Dollar     | A$     |
| NZD  | New Zealand Dollar    | NZ$    |
| CHF  | Swiss Franc           | CHF    |
| NOK  | Norwegian Krone       | kr     |
| SEK  | Swedish Krona         | kr     |
| DKK  | Danish Krone          | kr     |
| CNY  | Chinese Yuan          | ¥      |
| INR  | Indian Rupee          | ₹      |

**Implementation:**
- Currency stored as ISO code (e.g., "GBP", "USD")
- Applied consistently to all monetary displays
- Calculations remain currency-agnostic
- User-selectable via dropdown at top of module

---

## 2. RE-12.1 — Sums Insured

### Property Damage Breakdown
- Buildings & Improvements
- Plant & Machinery + Contents
- Stock & WIP
- Computers
- Other (editable label + value)
- **Total PD** (auto-calculated)

### Business Interruption Breakdown
- Gross Profit (annual)
- AICOW
- Loss of Rent
- Other (editable label + value)
- Indemnity Period (months)
- Operating days per year
- **Monthly BI value** (auto-calculated from total / 12)
- **Daily BI value** (auto-calculated from total / operating days)
- **Total BI** (auto-calculated)

### Summary
- **Total Sum Insured (PD + BI)** (auto-calculated)
- Additional comments (free text)

---

## 3. RE-12.2 — Worst Case Loss Estimate (WLE)

### Scenario Inputs
- Scenario summary (short text)
- Scenario description (detailed narrative)

### Property Damage Loss Calculations
- % loss per PD category (user-entered 0-100%)
- Sub-totals per category (auto-calculated from % × sum insured)
- **WLE PD Total** (auto)
- **% of Total PD** (auto)

### Business Interruption Loss Calculations
- Outage duration (months)
- % of Gross Profit (0-100%)
- **BI loss** (auto: Gross Profit × (% / 100) × (months / 12))
- **WLE BI Total** (auto)
- **% of Total BI** (auto)

### WLE Totals
- **WLE PD + BI Total** (auto)
- **% of Total PD + BI** (auto)

---

## 4. RE-12.3 — NLE – Existing Conditions

### Structure
Identical structure to WLE with separate inputs:
- Scenario summary (short text)
- Scenario description (detailed narrative)
- Property Damage: % loss per category → sub-totals → NLE PD Total → % of Total PD
- Business Interruption: outage duration + % GP → BI loss → NLE BI Total → % of Total BI
- **NLE PD + BI Total** (auto)
- **% of Total PD + BI** (auto)

**Key difference:** Separate assumptions and percentages from WLE, allowing engineers to model expected loss scenarios with fire protection and management controls credited.

---

## 5. Loss Expectancy Summary

A comprehensive comparison table at the bottom:

| Metric | Value | % of Sums Insured |
|--------|-------|-------------------|
| WLE    | (auto) | (auto)            |
| NLE    | (auto) | (auto)            |
| **NLE as % of WLE** | (auto) | — |

---

## 6. V1 Scope — Explicit Exclusions

The following are **NOT** included in v1:

❌ No BI recovery phases
❌ No charts or graphs
❌ No AI-generated or AI-modified numbers
❌ No AI-generated scenario text
❌ No auto-linking of recommendations into loss estimates
❌ No module outcome or grading section
❌ No scoring logic

**All narratives are engineer-entered. All calculations are deterministic and transparent.**

---

## 7. Technical Implementation

### Data Structure

```typescript
{
  currency: 'GBP',
  sums_insured: {
    property_damage: {
      buildings_improvements: number | null,
      plant_machinery_contents: number | null,
      stock_wip: number | null,
      computers: number | null,
      other_label: string,
      other: number | null
    },
    business_interruption: {
      gross_profit_annual: number | null,
      aicow: number | null,
      loss_of_rent: number | null,
      other_label: string,
      other: number | null,
      indemnity_period_months: number | null,
      operating_days_per_year: number | null
    },
    additional_comments: string
  },
  wle: {
    scenario_summary: string,
    scenario_description: string,
    property_damage: {
      buildings_improvements_pct: number | null,
      plant_machinery_contents_pct: number | null,
      stock_wip_pct: number | null,
      computers_pct: number | null,
      other_pct: number | null
    },
    business_interruption: {
      outage_duration_months: number | null,
      gross_profit_pct: number | null
    }
  },
  nle: {
    // Same structure as wle
  }
}
```

### Calculation Logic

**All calculations are performed client-side in real-time:**

- Total PD = sum of all property damage categories
- Total BI = sum of all business interruption categories
- Monthly BI = Total BI / 12
- Daily BI = Total BI / operating days per year
- Total Sums Insured = Total PD + Total BI
- WLE PD Sub-total = Sum Insured × (% / 100)
- WLE BI Loss = Gross Profit × (% GP / 100) × (months / 12)
- Similar logic for NLE

**All calculations are transparent, deterministic, and use only user-entered inputs.**

---

## 8. File Modified

**File:** `src/components/modules/forms/RE12LossValuesForm.tsx`
**Lines:** 1,200 lines (complete rewrite)
**Status:** ✅ Built successfully

---

## 9. Usage Notes

### For Engineers
1. Select currency at the top
2. Complete RE-12.1 Sums Insured with full breakdown
3. Enter WLE scenario and loss percentages for worst-case scenario
4. Enter NLE scenario and loss percentages for expected scenario with fire protection
5. Review auto-calculated totals and percentages
6. Save module

### For AI Summary Generation
The structured data from RE-12 is available for:
- Executive summary generation
- Report narrative inclusion
- Loss expectancy commentary

**AI does not modify RE-12 data. It only reads and summarizes it.**

---

## 10. V1 Lock Status

**RE-12 is now locked for v1.**
No additional features will be added until v2 planning.

The module implements the complete v1 specification:
✅ 12-currency support
✅ RE-12.1 Sums Insured with full breakdown
✅ RE-12.2 WLE with percentage-based calculations
✅ RE-12.3 NLE with separate assumptions
✅ Transparent deterministic calculations
✅ No scoring, no grading, no module outcome
✅ Engineer-entered narratives only

---

**End of Document**
