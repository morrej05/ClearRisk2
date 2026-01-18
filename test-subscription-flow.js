#!/usr/bin/env node

const crypto = require('crypto');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';

const TEST_ORG_ID = process.argv[2];
const TEST_PRICE_ID = process.argv[3] || process.env.STRIPE_PRICE_CORE_MONTHLY || 'price_core_monthly_test';

if (!TEST_ORG_ID) {
  console.error('Usage: node test-subscription-flow.js <organisation_id> [price_id]');
  console.error('Example: node test-subscription-flow.js 12345678-1234-1234-1234-123456789012');
  process.exit(1);
}

function createWebhookSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

async function sendWebhookEvent(eventType, eventData) {
  const event = {
    id: `evt_${crypto.randomBytes(12).toString('hex')}`,
    type: eventType,
    data: {
      object: eventData,
    },
    created: Math.floor(Date.now() / 1000),
  };

  const payload = JSON.stringify(event);
  const signature = createWebhookSignature(payload, WEBHOOK_SECRET);

  console.log(`\nSending ${eventType} event...`);
  console.log(`Event ID: ${event.id}`);

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/stripe-webhook-v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': signature,
      },
      body: payload,
    });

    const result = await response.json();
    console.log(`Response:`, result);

    if (!response.ok) {
      throw new Error(`Webhook failed: ${JSON.stringify(result)}`);
    }

    return result;
  } catch (error) {
    console.error(`Error sending webhook:`, error.message);
    throw error;
  }
}

async function testSubscriptionFlow() {
  console.log('='.repeat(60));
  console.log('SUBSCRIPTION FLOW TEST');
  console.log('='.repeat(60));
  console.log(`Organisation ID: ${TEST_ORG_ID}`);
  console.log(`Price ID: ${TEST_PRICE_ID}`);
  console.log(`Supabase URL: ${SUPABASE_URL}`);

  const customerId = `cus_test_${Date.now()}`;
  const subscriptionId = `sub_test_${Date.now()}`;

  try {
    console.log('\n\n--- Step 1: Checkout Session Completed (Core Monthly) ---');
    await sendWebhookEvent('checkout.session.completed', {
      id: `cs_${crypto.randomBytes(12).toString('hex')}`,
      customer: customerId,
      subscription: subscriptionId,
      metadata: {
        organisation_id: TEST_ORG_ID,
        user_id: 'test_user_id',
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log('\n\n--- Step 2: Subscription Updated (Active) ---');
    await sendWebhookEvent('customer.subscription.updated', {
      id: subscriptionId,
      customer: customerId,
      status: 'active',
      items: {
        data: [
          {
            price: {
              id: TEST_PRICE_ID,
            },
          },
        ],
      },
      metadata: {
        organisation_id: TEST_ORG_ID,
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log('\n\n--- Step 3: Subscription Updated (Professional) ---');
    const proPriceId = process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly_test';
    await sendWebhookEvent('customer.subscription.updated', {
      id: subscriptionId,
      customer: customerId,
      status: 'active',
      items: {
        data: [
          {
            price: {
              id: proPriceId,
            },
          },
        ],
      },
      metadata: {
        organisation_id: TEST_ORG_ID,
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log('\n\n--- Step 4: Subscription Canceled ---');
    await sendWebhookEvent('customer.subscription.deleted', {
      id: subscriptionId,
      customer: customerId,
      status: 'canceled',
      items: {
        data: [
          {
            price: {
              id: proPriceId,
            },
          },
        ],
      },
      metadata: {
        organisation_id: TEST_ORG_ID,
      },
    });

    console.log('\n\n' + '='.repeat(60));
    console.log('TEST COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log('\nExpected database state:');
    console.log('  plan_type: free');
    console.log('  subscription_status: canceled');
    console.log('  max_editors: 0');
    console.log('\nVerify in Supabase dashboard or run a SQL query:');
    console.log(`  SELECT * FROM organisations WHERE id = '${TEST_ORG_ID}';`);
  } catch (error) {
    console.error('\n\nTEST FAILED:', error.message);
    process.exit(1);
  }
}

testSubscriptionFlow();
