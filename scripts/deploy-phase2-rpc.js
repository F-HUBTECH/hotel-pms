#!/usr/bin/env node

/**
 * Hotel PMS - Phase 2 RPC Functions Deployment
 * Deploys forecast RPC functions to Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

// Create Supabase client with service role
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deployRpcFunctions() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║   HOTEL PMS - PHASE 2 RPC FUNCTIONS DEPLOYMENT   ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  // Read SQL file
  const sqlFilePath = path.join(__dirname, '../supabase/phase2_rpc_functions.sql');
  const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

  console.log('📂 Reading SQL file: phase2_rpc_functions.sql');
  console.log('📊 SQL file size:', sqlContent.length, 'bytes\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Deploying: Phase 2 - RPC Functions');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Function names to deploy
  const functionNames = [
    'rpc_generate_daily_forecast',
    'rpc_calculate_daily_summary',
    'rpc_adjust_forecast_item',
    'rpc_update_room_status_date',
    'rpc_get_forecast_room_grid',
    'rpc_get_forecast_summary'
  ];

  let successCount = 0;

  // The SQL file needs to be executed directly
  // Since we can't use exec_sql RPC directly, we'll provide instructions
  console.log('⚠️  Note: RPC functions need to be executed in Supabase SQL Editor');
  console.log('   https://app.supabase.com/project/rbpiwglmpahwvabzcgzr/sql/new\n');

  console.log('📝 Functions to deploy:');
  functionNames.forEach((fn, i) => {
    console.log(`   ${i + 1}. ${fn}`);
  });

  console.log('\n📋 Instructions:');
  console.log('   1. Open Supabase SQL Editor');
  console.log('   2. Copy contents of phase2_rpc_functions.sql');
  console.log('   3. Paste and execute');
  console.log('   4. Verify functions are created');

  // Check which functions already exist
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Checking existing functions...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (const fnName of functionNames) {
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: `SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = '${fnName}';`
      });

      if (!error && data) {
        console.log(`✅ Function '${fnName}' exists`);
        successCount++;
      } else {
        console.log(`⚠️  Function '${fnName}' not found or not accessible`);
      }
    } catch (e) {
      // Try using REST API to check
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            sql_query: `SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = '${fnName}';`
          })
        });

        if (response.ok) {
          console.log(`✅ Function '${fnName}' exists`);
          successCount++;
        } else {
          console.log(`⚠️  Function '${fnName}' not found`);
        }
      } catch (e2) {
        console.log(`⚠️  Function '${fnName}' - unable to check`);
      }
    }
  }

  console.log(`\n📊 Functions checked: ${successCount}/${functionNames.length}`);

  if (successCount === functionNames.length) {
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║             ✅ ALL RPC FUNCTIONS FOUND                ║');
    console.log('╚════════════════════════════════════════════════════╝\n');
  } else {
    console.log('\n⚠️  Some RPC functions are missing.');
    console.log('📝 Please run the SQL file in Supabase SQL Editor:');
    console.log('   https://app.supabase.com/project/rbpiwglmpahwvabzcgzr/sql/new');
    console.log('   File: /media/doung/New Volume/Project for zed/KFO/hotel-pms/supabase/phase2_rpc_functions.sql\n');
  }

  process.exit(0);
}

deployRpcFunctions().catch(error => {
  console.error('\n❌ Deployment failed:', error.message);
  process.exit(1);
});
