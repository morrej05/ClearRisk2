#!/usr/bin/env node

/**
 * Color Regression Check
 *
 * Prevents introduction of new raw non-neutral Tailwind color utilities.
 * Reads baseline from docs/non-neutral-colours.summary.txt and fails if
 * the current scan finds more matches than the baseline.
 */

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const SUMMARY_FILE = path.join(__dirname, '../docs/non-neutral-colours.summary.txt');

function getBaselineTotal() {
  if (!fs.existsSync(SUMMARY_FILE)) {
    console.error('❌ Baseline file not found:', SUMMARY_FILE);
    console.error('   Run: python3 scripts/non_neutral_colours_report.py');
    process.exit(1);
  }

  const content = fs.readFileSync(SUMMARY_FILE, 'utf8');
  const match = content.match(/Total non-neutral color matches:\s*(\d+)/);

  if (!match) {
    console.error('❌ Could not parse baseline total from:', SUMMARY_FILE);
    console.error('   Expected format: "Total non-neutral color matches: N"');
    process.exit(1);
  }

  return parseInt(match[1], 10);
}

function getCurrentTotal() {
  try {
    // Run the scanner and capture output
    const output = execSync('python3 scripts/non_neutral_colours_report.py', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Parse the output for total matches
    const match = output.match(/Total non-neutral color matches:\s*(\d+)/);
    if (!match) {
      console.error('❌ Could not parse current total from scanner output');
      console.error('   Expected format: "Total non-neutral color matches: N"');
      process.exit(1);
    }

    return parseInt(match[1], 10);
  } catch (error) {
    console.error('❌ Failed to run color scanner:', error.message);
    process.exit(1);
  }
}

function main() {
  console.log('🎨 Checking for color regressions...\n');

  const baseline = getBaselineTotal();
  const current = getCurrentTotal();

  console.log(`📊 Baseline:  ${baseline} raw non-neutral color utilities`);
  console.log(`📊 Current:   ${current} raw non-neutral color utilities`);

  if (current > baseline) {
    console.log(`\n❌ REGRESSION DETECTED: +${current - baseline} new raw color utilities`);
    console.log('\n📝 Please use semantic tokens instead:');
    console.log('   • Use ui/brand/risk tokens from src/theme/tokens.ts');
    console.log('   • Use semantic helpers from src/theme/semanticClasses.ts');
    console.log('   • See docs/colour-system.md for migration guide');
    process.exit(1);
  } else if (current < baseline) {
    console.log(`\n✅ IMPROVEMENT: -${baseline - current} raw color utilities removed!`);
    console.log('   Please update baseline: python3 scripts/non_neutral_colours_report.py');
    process.exit(0);
  } else {
    console.log('\n✅ No color regressions detected');
    process.exit(0);
  }
}

main();
