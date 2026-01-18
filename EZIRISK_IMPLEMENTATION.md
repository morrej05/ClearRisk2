# EziRisk Finalization Implementation

## Summary

Complete implementation of EziRisk branding, subscription plans, Stripe integration, and discipline-based feature gating system.

## 1. Database Schema Changes

### Migration: `ezirisk_finalization_schema_v2`

**Plan System**
- Updated plan types: `free`, `core`, `professional`, `enterprise`
- Migrated all existing users from trial/pro/pro_fra to free plan
- All data preserved during migration

**Role System**
- Updated roles: `admin`, `surveyor`, `viewer`
- Migrated: super_admin → admin, org_admin → admin
- surveyors and viewers remain unchanged

**New Organization Fields**
- `discipline_type`: engineering | assessment | both
  - Default: 'engineering'
  - 'both' only for enterprise plans
- `bolt_ons`: JSONB array of feature flags
  - e.g., ["fra_form", "bcm_form", "specialist_modules"]
  - All enabled by default for enterprise
- `max_editors`: Plan-based editor limit
  - Free: 999
  - Core: 1
  - Professional: 3
  - Enterprise: 10
- `active_editors`: Current count of active editors

**Stripe Integration Fields**
- `stripe_customer_id`: Stripe customer ID
- `stripe_subscription_id`: Stripe subscription ID
- `subscription_status`: active | past_due | canceled | inactive
- `billing_cycle`: monthly | annual

## 2. Permissions System

### File: `src/utils/permissions.ts`

**New Types**
```typescript
type UserRole = 'admin' | 'surveyor' | 'viewer';
type SubscriptionPlan = 'free' | 'core' | 'professional' | 'enterprise';
type DisciplineType = 'engineering' | 'assessment' | 'both';
```

**Plan Limits**
```typescript
interface PlanLimits {
  maxEditors: number;
  canSwitchDiscipline: boolean;
  hasSmartRecommendations: boolean;
  hasBoltOns: boolean;
}
```

**Key Functions**
- `getPlanLimits(plan)`: Returns editor limits and feature access
- `canAccessSmartRecommendations(plan)`: Professional and Enterprise only
- `canAccessFRAModule(plan)`: Professional and Enterprise only
- `canSwitchDiscipline(plan)`: Enterprise only
- `hasBoltOnAccess(plan)`: Enterprise only

**Role Permissions**
- **Admin**: Full access including user management, billing, all survey operations
- **Surveyor**: Create/edit surveys within plan limits, no admin access
- **Viewer**: Read-only access, can export reports, cannot edit

## 3. AuthContext Updates

### File: `src/contexts/AuthContext.tsx`

**New Context Fields**
```typescript
interface AuthContextType {
  user: User | null;
  userRole: UserRole | null;
  userPlan: SubscriptionPlan | null;
  disciplineType: DisciplineType | null;
  boltOns: string[];
  maxEditors: number;
  activeEditors: number;
  // ... existing methods
}
```

All fields automatically fetched on authentication and available throughout the app.

## 4. Stripe Integration

### Webhook Handler: `supabase/functions/stripe-webhook/index.ts`

**Verified, Idempotent Webhook Processing**

**Events Handled:**

1. `checkout.session.completed`
   - Sets organization plan based on price ID
   - Stores stripe_customer_id and stripe_subscription_id
   - Sets subscription_status to 'active'
   - Updates max_editors based on plan
   - Uses client_reference_id to identify user

2. `customer.subscription.updated`
   - If status != 'active': Downgrades to free plan
   - If status == 'active': Updates plan from price ID
   - Preserves all data during downgrade

3. `customer.subscription.deleted`
   - Downgrades to free plan
   - Sets subscription_status to 'canceled'
   - Data preserved, editing locked

**Security**
- HMAC-SHA256 signature verification
- Idempotent processing (safe to retry)
- Service role key for database updates

**Deployed**: ✓ (via mcp__supabase__deploy_edge_function)

### Checkout Integration: `src/pages/UpgradePage.tsx`

**Features:**
- Monthly/Annual billing toggle (17% annual savings)
- 4 plan cards: Free, Core ($49/$490), Professional ($149/$1490), Enterprise (Contact Sales)
- Self-serve checkout for Core and Professional
- Enterprise redirects to sales email
- Stripe Checkout Session creation with:
  - Price ID based on plan + billing cycle
  - client_reference_id = user.id
  - Success/cancel URLs

**Editor Limits Display:**
- Free: Unlimited editors (actually 999)
- Core: 1 Editor
- Professional: 3 Editors
- Enterprise: 10 Editors

## 5. Feature Gating UI

### Upgrade Banner: `src/components/TrialBanner.tsx`

Renamed to `UpgradeBanner`, shown for free and core plans:
- Free: "Upgrade to Professional for Smart Recommendations"
- Core: "Upgrade to Professional for 3 editor seats"
- Dismissible per session
- "Upgrade Now" button → /upgrade page

### Smart Recommendations Lock

**File: `src/components/NewSurveyReport.tsx`**

When `!canAccessSmartRecommendations(userPlan)`:
- Shows lock icon with upgrade prompt
- "Smart Recommendations requires Pro"
- "View Plans" button
- No access to Smart Recommendations table

### FRA Module Lock

**File: `src/components/NewSurveyModal.tsx`**

FRA dropdown option:
- Disabled for free/core plans
- Text: "Fire Risk Assessment (FRA) — Pro FRA Plan Required"
- Helper text indicates plan requirement
- Only enabled for Professional and Enterprise

## 6. Branding Updates

### EziRisk Rebranding

**Updated Files:**
- `src/contexts/ClientBrandingContext.tsx`: Default company name → 'EziRisk'
- `supabase/migrations/20260115152155_add_client_branding_v2.sql`: DEFAULT 'EziRisk'
- All references to sales email: sales@ezirisk.com
- UpgradePage contact sales button: mailto:sales@ezirisk.com

**Remaining Files with ClearRisk** (non-critical, for future cleanup):
- Landing page components (WhyClearRisk.tsx, etc.)
- Report generators
- Some admin pages
- These don't affect core functionality

## 7. Plan Feature Matrix

| Feature | Free | Core | Professional | Enterprise |
|---------|------|------|--------------|------------|
| Editors | Unlimited* | 1 | 3 | 10 |
| Viewers | Unlimited | Unlimited | Unlimited | Unlimited |
| Surveys | ✓ | ✓ | ✓ | ✓ |
| PDF Reports | ✓ | ✓ | ✓ | ✓ |
| Smart Recommendations | ✗ | ✗ | ✓ | ✓ |
| FRA Module | ✗ | ✗ | ✓ | ✓ |
| Custom Branding | ✗ | Basic | ✓ | ✓ |
| Discipline Switching | ✗ | ✗ | ✗ | ✓ |
| Bolt-ons | ✗ | ✗ | ✗ | ✓ |
| Priority Support | ✗ | Email | ✓ | Dedicated |

*Unlimited = 999 editors (soft limit)

## 8. Subscription Workflow

### User Upgrades (Core or Professional)
1. User clicks "Upgrade" button on UpgradePage
2. Stripe Checkout Session created with:
   - Selected price_id (monthly or annual)
   - client_reference_id = user.id
3. User completes payment in Stripe
4. Stripe sends `checkout.session.completed` webhook
5. Webhook handler updates user_profiles:
   - Sets plan
   - Stores Stripe IDs
   - Updates max_editors
   - Sets subscription_status = 'active'
6. User redirected to dashboard with upgrade=success
7. AuthContext refreshes, new features unlocked

### Subscription Cancellation/Failure
1. Stripe sends `customer.subscription.updated` (status != active)
2. Webhook downgrades user to free plan
3. max_editors reset to 999
4. subscription_status updated
5. User can still access all their data
6. Editing restricted if over editor limit

### Enterprise Upgrade
- User clicks "Contact Sales" button
- Opens mailto:sales@ezirisk.com
- Manual setup by sales team

## 9. Editor Limit Enforcement

### Current Implementation
- `max_editors` stored in user_profiles
- `active_editors` tracks current count
- Frontend checks available via `maxEditors` and `activeEditors` in AuthContext

### To Be Implemented (Backend Guards)
- Block new editor creation if activeEditors >= maxEditors
- Viewer creation unlimited
- Admin can activate/deactivate editors
- Downgrade does not remove editors, only prevents new ones

## 10. Discipline System

### Schema
- `discipline_type`: engineering | assessment | both
- Stored at organization level (user_profiles)

### Rules
- Default: 'engineering' for all new users
- 'both' only available for Enterprise plan
- `canSwitchDiscipline(plan)` checks if switching allowed

### UI Integration (To Be Implemented)
- Discipline context visible in UI
- Forms/reports filtered by discipline
- Navigation filtered by discipline
- Enterprise users can toggle between disciplines

## 11. Bolt-Ons

### Schema
- `bolt_ons`: JSONB array, e.g. ["fra_form", "bcm_form"]
- Enterprise gets all bolt-ons by default

### Bolt-On Types
- `fra_form`: Fire Risk Assessment form module
- `bcm_form`: Business Continuity Management form
- `specialist_modules`: Additional specialized modules

### Usage
- Check via `boltOns.includes('fra_form')`
- Unlocks additional forms only
- Does not change discipline
- Managed via Stripe as subscription add-ons (future)

## 12. Environment Variables Needed

```env
# Existing (already configured)
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# New (required for Stripe)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Note:** Stripe keys must be added to `.env` for checkout to work.

## 13. Stripe Product Setup Required

### In Stripe Dashboard:

**Products:**
1. EziRisk Core
   - Monthly: `price_core_monthly` ($49)
   - Annual: `price_core_annual` ($490)

2. EziRisk Professional
   - Monthly: `price_professional_monthly` ($149)
   - Annual: `price_professional_annual` ($1490)

**Webhook Endpoint:**
- URL: `https://[project-ref].supabase.co/functions/v1/stripe-webhook`
- Events to send:
  - checkout.session.completed
  - customer.subscription.updated
  - customer.subscription.deleted

## 14. Testing Checklist

- [x] Build succeeds
- [ ] Free user sees upgrade banner
- [ ] Core user sees Smart Recommendations locked
- [ ] Professional user can access Smart Recommendations
- [ ] FRA module disabled for free/core
- [ ] Stripe checkout creates session
- [ ] Webhook correctly upgrades user
- [ ] Webhook correctly downgrades on cancellation
- [ ] Editor limits enforced
- [ ] Discipline displayed correctly
- [ ] Bolt-ons checked correctly

## 15. Future Enhancements

### High Priority
1. Complete ClearRisk → EziRisk rebrand in all UI files
2. Implement backend editor limit enforcement
3. Add discipline-based navigation filtering
4. Add discipline switcher UI (Enterprise only)
5. Test Stripe integration end-to-end

### Medium Priority
1. Add Stripe Customer Portal for self-service
2. Implement bolt-on management UI
3. Add usage analytics per plan
4. Create admin panel for viewing subscription status
5. Add grace period for failed payments

### Low Priority
1. Per-seat billing (not in scope currently)
2. Usage-based AI billing
3. Promo codes and trials
4. Custom enterprise contracts

## 16. Migration Notes

All existing users automatically migrated to:
- Plan: free
- Role: admin (if super_admin or org_admin), surveyor (if surveyor)
- Discipline: engineering
- max_editors: 999
- No data loss
- All surveys, reports, and settings preserved

## Build Status

✓ Project builds successfully
✓ No TypeScript errors
✓ All new types properly integrated
