/**
 * Auto-run SQL seed script using Supabase API
 * Run with: npx ts-node src/lib/db/auto-seed.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables')
  console.error('Need: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function runSQL() {
  console.log('🚀 Auto-running SQL seed script...\n')
  
  const sqlPath = path.join(__dirname, '../../../supabase/complete_seed.sql')
  const sql = fs.readFileSync(sqlPath, 'utf-8')
  
  // Split SQL into separate statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
  
  console.log(`Found ${statements.length} SQL statements\n`)
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ';'
    const preview = stmt.substring(0, 50).replace(/\n/g, ' ') + '...'
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt })
      
      if (error) {
        console.error(`\n❌ Statement ${i + 1} failed: ${preview}`)
        console.error(`   Error: ${error.message}`)
        
        // Continue on error (might be IF NOT EXISTS related)
        if (error.message.includes('already exists') || 
            error.message.includes('does not exist') ||
            error.message.includes('duplicate key')) {
          console.log(`   ⚠️  Continuing...`)
        }
      } else {
        console.log(`✅ Statement ${i + 1}: ${preview}`)
      }
    } catch (err: any) {
      console.error(`\n❌ Statement ${i + 1} error: ${err.message}`)
    }
  }
  
  console.log('\n🎉 SQL execution complete!')
  
  // Verify rooms were created
  const { data: rooms, error } = await supabase
    .from('rooms')
    .select('room_number, status')
    .limit(10)
  
  if (error) {
    console.error('❌ Failed to verify rooms:', error.message)
  } else {
    console.log(`\n📊 Verification: Found ${rooms?.length || 0} rooms`)
    rooms?.forEach(r => console.log(`   - Room ${r.room_number}: ${r.status}`))
  }
}

runSQL().catch(console.error)
