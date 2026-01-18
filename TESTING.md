# Subscription Flow Testing Guide

## Overview

This guide explains how to test the subscription upgrade/downgrade flow with Stripe webhooks in development and test environments.

## Prerequisites

1. **Environment Variables**: Ensure the following are set in your `.env`:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_test_...
   STRIPE_PRICE_CORE_MONTHLY=price_...
   STRIPE_PRICE_CORE_ANNUAL=price_...
   STRIPE_PRICE_PRO_MONTHLY=price_...
   STRIPE_PRICE_PRO_ANNUAL=price_...
   ```

2. **Stripe Test Mode**: Use Stripe test keys (starting with `pk_test_` and `sk_test_`)

3. **Organisation ID**: Get an organisation ID from your database:
   ```sql
   SELECT id, name FROM organisations LIMIT 1;
   ```

## Testing Methods

### Method 1: Automated Test Script (Recommended for CI/CD)

The `test-subscription-flow.js` script simulates the complete subscription lifecycle by sending webhook events directly to your edge function.

#### Running the Test

```bash
# Basic usage
node test-subscription-flow.js <organisation_id>

# Example
node test-subscription-flow.js 12345678-1234-1234-1234-123456789012

# With custom price ID
node test-subscription-flow.js 12345678-1234-1234-1234-123456789012 price_core_monthly
```

#### Test Flow

The script tests the following sequence:

1. **Free Plan → Core**
   - Simulates `checkout.session.completed` event
   - Expected: `plan_type = 'core'`, `subscription_status = 'active'`, `max_editors = 1`

2. **Core → Professional**
   - Simulates `customer.subscription.updated` with Pro price
   - Expected: `plan_type = 'professional'`, `subscription_status = 'active'`, `max_editors = 3`

3. **Professional → Canceled**
   - Simulates `customer.subscription.deleted`
   - Expected: `plan_type = 'free'`, `subscription_status = 'canceled'`, `max_editors = 0`

#### Verifying Results

After running the test, verify the database state:

```sql
SELECT
  id,
  name,
  plan_type,
  subscription_status,
  max_editors,
  stripe_customer_id,
  stripe_subscription_id,
  updated_at
FROM organisations
WHERE id = 'your-org-id';
```

### Method 2: Stripe CLI Webhook Forwarding (Recommended for Manual Testing)

Use the Stripe CLI to forward real webhook events from Stripe test mode to your local environment.

#### Setup

1. Install Stripe CLI:
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe

   # Linux
   wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_*_linux_x86_64.tar.gz
   tar -xvf stripe_*_linux_x86_64.tar.gz
   ```

2. Login to Stripe:
   ```bash
   stripe login
   ```

3. Forward webhooks to your local edge function:
   ```bash
   stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook-v2
   ```

   This will output a webhook signing secret like `whsec_...` - add this to your `.env`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

#### Testing Flow

1. **Trigger a test payment** in Stripe Dashboard or via Stripe CLI:
   ```bash
   stripe trigger checkout.session.completed
   ```

2. **Watch the events** in the Stripe CLI output and your application logs

3. **Verify database changes** after each event

### Method 3: Stripe Dashboard Webhook Testing

For testing specific webhook events:

1. Go to **Stripe Dashboard** → **Developers** → **Webhooks**
2. Click **Add endpoint** (if needed)
3. Enter your webhook URL: `https://your-project.supabase.co/functions/v1/stripe-webhook-v2`
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Use **Send test webhook** to trigger specific events

## Manual End-to-End Testing

### Test Case 1: Free to Core Upgrade

1. **Initial State**:
   - User on free plan
   - `plan_type = 'free'`, `subscription_status = 'inactive'`, `max_editors = 0`

2. **Action**: Navigate to `/upgrade` and click "Upgrade to Core Monthly"

3. **Expected**:
   - Redirect to Stripe Checkout
   - Use test card: `4242 4242 4242 4242` (any future date, any CVC)
   - Complete payment

4. **Verify**:
   - Webhook received: `checkout.session.completed`
   - Database updated: `plan_type = 'core'`, `subscription_status = 'active'`, `max_editors = 1`
   - User can edit surveys
   - Admin dashboard shows correct plan

### Test Case 2: Core to Professional Upgrade

1. **Initial State**: User on Core plan

2. **Action**: Navigate to `/upgrade` and click "Upgrade to Professional Monthly"

3. **Expected**:
   - Redirect to Stripe Checkout
   - Complete payment with test card

4. **Verify**:
   - Webhook received: `customer.subscription.updated`
   - Database updated: `plan_type = 'professional'`, `max_editors = 3`
   - Pro features unlocked (AI polish, smart recommendations)

### Test Case 3: Subscription Cancellation

1. **Initial State**: User on paid plan

2. **Action**:
   - In Stripe Dashboard, cancel the subscription
   - OR simulate cancellation webhook

3. **Expected**:
   - Webhook received: `customer.subscription.deleted`

4. **Verify**:
   - Database updated: `plan_type = 'free'`, `subscription_status = 'canceled'`, `max_editors = 0`
   - Editing locked (user can view but not edit)
   - Data still accessible
   - Export functionality still works

### Test Case 4: Past Due Subscription

1. **Action**: Simulate a failed payment:
   ```bash
   stripe trigger customer.subscription.updated --add subscription:status=past_due
   ```

2. **Verify**:
   - Database updated: `subscription_status = 'past_due'`
   - Editing remains locked
   - User sees warning message

## Feature Entitlement Testing

### Test Editing Permissions

```typescript
// Test cases to verify
const testCases = [
  {
    plan: 'free',
    status: 'inactive',
    role: 'admin',
    canEdit: false,  // No editing on free plan
  },
  {
    plan: 'core',
    status: 'active',
    role: 'surveyor',
    canEdit: true,  // Can edit on active Core
  },
  {
    plan: 'professional',
    status: 'active',
    role: 'admin',
    canEdit: true,
    canAccessProFeatures: true,  // AI features available
  },
  {
    plan: 'core',
    status: 'canceled',
    role: 'admin',
    canEdit: false,  // No editing on canceled subscription
  },
  {
    plan: 'enterprise',
    status: 'inactive',
    role: 'admin',
    canEdit: true,  // Enterprise always active
  },
];
```

### Test Pro Features

1. **AI Polish** (Professional/Enterprise only):
   - Navigate to survey report
   - Click "AI Polish" button
   - Free/Core: Button disabled or shows upgrade prompt
   - Pro/Enterprise: AI processing works

2. **Smart Recommendations** (Professional/Enterprise only):
   - View recommendations tab
   - Free/Core: Basic recommendations only
   - Pro/Enterprise: AI-powered smart recommendations visible

## Webhook Idempotency Testing

Test that duplicate webhook events are handled correctly:

```bash
# Send the same event ID twice
node test-subscription-flow.js <org_id>
node test-subscription-flow.js <org_id>  # Should skip duplicate events
```

Expected: Second run logs "Event already processed, skipping"

## Troubleshooting

### Webhook Not Received

1. Check Edge Function logs in Supabase Dashboard
2. Verify `STRIPE_WEBHOOK_SECRET` is correct
3. Ensure webhook signature verification is working
4. Check network connectivity

### Database Not Updated

1. Verify organisation ID in webhook metadata matches database
2. Check RLS policies allow updates
3. Review edge function logs for errors
4. Verify price ID mapping in webhook handler

### Duplicate Processing

1. Check `stripe_events_processed` table for duplicate event IDs
2. Verify idempotency logic is working
3. Review edge function implementation

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test Subscription Flow

on: [push, pull_request]

jobs:
  test-subscriptions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run subscription flow test
        env:
          VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_WEBHOOK_SECRET }}
          STRIPE_PRICE_CORE_MONTHLY: ${{ secrets.STRIPE_PRICE_CORE_MONTHLY }}
          STRIPE_PRICE_PRO_MONTHLY: ${{ secrets.STRIPE_PRICE_PRO_MONTHLY }}
        run: |
          # Create test organisation
          ORG_ID=$(node -e "console.log(require('crypto').randomUUID())")

          # Run test flow
          node test-subscription-flow.js $ORG_ID
```

## Test Data

### Stripe Test Cards

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Insufficient Funds**: `4000 0000 0000 9995`
- **Requires Authentication**: `4000 0025 0000 3155`

Use any future expiry date and any 3-digit CVC.

### Test Organisation Data

```sql
-- Create test organisation
INSERT INTO organisations (
  id,
  name,
  plan_type,
  discipline_type,
  enabled_addons,
  max_editors,
  subscription_status
) VALUES (
  'test-org-id',
  'Test Organisation',
  'free',
  'engineering',
  '[]'::jsonb,
  0,
  'inactive'
);
```

## Expected Behavior Summary

| Scenario | plan_type | subscription_status | max_editors | canEdit | canAccessProFeatures |
|----------|-----------|--------------------|-----------  |---------|---------------------|
| New signup | free | inactive | 0 | false | false |
| Core monthly active | core | active | 1 | true | false |
| Pro monthly active | professional | active | 3 | true | true |
| Subscription canceled | free | canceled | 0 | false | false |
| Subscription past_due | *unchanged* | past_due | *unchanged* | false | false |
| Enterprise (always) | enterprise | *any* | 10+ | true | true |

## Notes

- **Data Preservation**: Canceling subscription downgrades to free but preserves all data
- **View Access**: All users can view data regardless of subscription status
- **Export Access**: All users can export data regardless of subscription status
- **Editing Lock**: Only active paid subscriptions (or enterprise) allow editing
- **Pro Features**: Only Professional and Enterprise plans have AI features
- **Idempotency**: All webhook events are idempotent using event ID tracking
- **Security**: Webhook signatures are always verified

## Support

For issues or questions:
1. Check Supabase Edge Function logs
2. Check Stripe Dashboard webhook delivery logs
3. Review `stripe_events_processed` table for event history
4. Check `organisations` table for current state
