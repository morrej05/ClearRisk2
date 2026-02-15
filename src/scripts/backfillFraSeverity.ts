/**
 * Database Backfill Script: Legacy FRA Actions → Severity Engine
 *
 * This script backfills severity_tier and priority_band for legacy FRA actions
 * that were created with the old Likelihood × Impact scoring system.
 *
 * Run this script ONCE after deploying the new severity engine.
 *
 * Usage:
 *   npx tsx src/scripts/backfillFraSeverity.ts
 *
 * Safety:
 *   - Idempotent: safe to run multiple times
 *   - Preserves existing severity_tier/priority_band if already set
 *   - Does not modify likelihood/impact/score columns
 *   - Updates actions in batches to avoid timeouts
 */

import { createClient } from '@supabase/supabase-js';
import { migrateLegacyFraAction } from '../lib/modules/fra/migrateLegacyFraActions';
import type { FraContext } from '../lib/modules/fra/severityEngine';

// Load environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables:');
  console.error('   VITE_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface Document {
  id: string;
  document_type: string;
  organisation_id: string;
}

interface Action {
  id: string;
  document_id: string;
  severity_tier: string | null;
  priority_band: string | null;
  risk_score: number | null;
  likelihood: number | null;
  impact: number | null;
  finding_category: string | null;
}

async function backfillFraSeverity() {
  console.log('🚀 Starting FRA Severity Backfill...\n');

  try {
    // Step 1: Fetch all FRA/FSD/DSEAR documents
    console.log('📄 Fetching FRA/FSD/DSEAR documents...');
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('id, document_type, organisation_id')
      .in('document_type', ['FRA', 'FSD', 'DSEAR'])
      .is('deleted_at', null);

    if (docError) {
      console.error('❌ Error fetching documents:', docError);
      process.exit(1);
    }

    console.log(`✓ Found ${documents?.length || 0} FRA documents\n`);

    if (!documents || documents.length === 0) {
      console.log('✓ No documents to process. Exiting.');
      return;
    }

    let totalActionsProcessed = 0;
    let totalActionsUpdated = 0;
    let totalActionsSkipped = 0;

    // Step 2: Process each document
    for (const doc of documents) {
      console.log(`📋 Processing document: ${doc.id} (${doc.document_type})`);

      // Fetch building profile for FRA context
      const { data: modules } = await supabase
        .from('module_instances')
        .select('module_key, data')
        .eq('document_id', doc.id)
        .eq('module_key', 'A2_BUILDING_PROFILE')
        .maybeSingle();

      const fraContext: FraContext = {
        occupancyRisk: (modules?.data?.occupancy_risk || 'NonSleeping') as 'NonSleeping' | 'Sleeping' | 'Vulnerable',
        storeys: modules?.data?.number_of_storeys || null,
      };

      // Fetch actions for this document
      const { data: actions, error: actionsError } = await supabase
        .from('actions')
        .select('id, document_id, severity_tier, priority_band, risk_score, likelihood, impact, finding_category')
        .eq('document_id', doc.id)
        .is('deleted_at', null);

      if (actionsError) {
        console.error(`  ❌ Error fetching actions for ${doc.id}:`, actionsError);
        continue;
      }

      if (!actions || actions.length === 0) {
        console.log(`  ⏭️  No actions found\n`);
        continue;
      }

      console.log(`  📌 Found ${actions.length} actions`);

      // Step 3: Migrate and update actions
      for (const action of actions) {
        totalActionsProcessed++;

        // Skip if already migrated
        if (action.severity_tier && action.priority_band) {
          totalActionsSkipped++;
          continue;
        }

        // Migrate action
        const migratedAction = migrateLegacyFraAction(action, fraContext);

        // Update database
        const { error: updateError } = await supabase
          .from('actions')
          .update({
            severity_tier: migratedAction.severity_tier,
            priority_band: migratedAction.priority_band,
          })
          .eq('id', action.id);

        if (updateError) {
          console.error(`  ❌ Error updating action ${action.id}:`, updateError);
        } else {
          totalActionsUpdated++;
        }
      }

      console.log(`  ✓ Updated ${actions.length - totalActionsSkipped} actions\n`);
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ Backfill Complete!');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📊 Total actions processed: ${totalActionsProcessed}`);
    console.log(`✏️  Actions updated:         ${totalActionsUpdated}`);
    console.log(`⏭️  Actions skipped:         ${totalActionsSkipped}`);
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the backfill
backfillFraSeverity()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
