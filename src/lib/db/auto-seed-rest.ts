/**
 * Auto-seed using Supabase REST API
 * Run with: npx tsx src/lib/db/auto-seed-rest.ts
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import * as path from 'path'

// Load .env.local from project root
config({ path: path.resolve(__dirname, '../../../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('URL:', supabaseUrl ? '✓' : '✗')
console.log('Key:', supabaseKey ? '✓ (' + supabaseKey.substring(0, 20) + '...)' : '✗')

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

console.log('🔗 Connecting to:', supabaseUrl)

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function seed() {
  console.log('🚀 Starting auto-seed via REST API...\n')

  // 1. Property - use only basic fields
  const { data: property, error: propError } = await supabase
    .from('properties')
    .upsert({ 
      code: 'MAIN', 
      name: 'Main Hotel', 
      address: '123 Hotel Street'
    }, { onConflict: 'code' })
    .select()
    .single()
  
  if (propError) {
    console.error('❌ Property error:', propError.message)
    console.error('Details:', propError)
    return
  }
  
  if (!property) {
    console.error('❌ Failed to create property - no data returned')
    return
  }
  console.log('✅ Property:', property.id)

  const propId = property.id

  // 2. Buildings
  const buildings = [
    { property_id: propId, code: 'A', name: 'Building A - Main Tower', description: 'Main hotel tower' },
    { property_id: propId, code: 'B', name: 'Building B - Garden Wing', description: 'Garden wing' }
  ]

  const buildingIds: Record<string, string> = {}
  for (const b of buildings) {
    const { data } = await supabase
      .from('buildings')
      .upsert(b, { onConflict: 'property_id,code' })
      .select()
      .single()
    if (data) {
      buildingIds[b.code] = data.id
      console.log(`✅ Building ${b.code}:`, data.id)
    }
  }

  // 3. Room Types
  const roomTypes = [
    { code: 'STD', name: 'Standard Room', description: 'Standard', base_price: 1500 },
    { code: 'DLX', name: 'Deluxe Room', description: 'Deluxe', base_price: 2500 },
    { code: 'SUI', name: 'Suite', description: 'Suite', base_price: 4500 },
    { code: 'FAM', name: 'Family Room', description: 'Family', base_price: 3500 }
  ]

  const roomTypeIds: Record<string, string> = {}
  for (const rt of roomTypes) {
    const { data } = await supabase
      .from('room_types')
      .upsert(rt, { onConflict: 'code' })
      .select()
      .single()
    if (data) {
      roomTypeIds[rt.code] = data.id
      console.log(`✅ Room Type ${rt.code}:`, data.id)
    }
  }

  // 4. Floor Plans
  const floors = [
    { building_id: buildingIds['A'], code: 'G', name: 'Ground Floor' },
    { building_id: buildingIds['A'], code: '2', name: '2nd Floor' },
    { building_id: buildingIds['A'], code: '3', name: '3rd Floor' },
    { building_id: buildingIds['A'], code: '4', name: '4th Floor' },
    { building_id: buildingIds['B'], code: 'G', name: 'Ground Floor' },
    { building_id: buildingIds['B'], code: '2', name: '2nd Floor' }
  ]

  const floorIds: Record<string, string> = {}
  for (const f of floors) {
    const bCode = f.building_id === buildingIds['A'] ? 'A' : 'B'
    const key = `${bCode}-${f.code}`
    const { data } = await supabase
      .from('floor_plans')
      .upsert(f, { onConflict: 'building_id,code' })
      .select()
      .single()
    if (data) {
      floorIds[key] = data.id
      console.log(`✅ Floor ${key}:`, data.id)
    }
  }

  // 5. Rooms
  const rooms = [
    { n: '101', t: 'STD', f: 'A-G', s: 'available' },
    { n: '102', t: 'STD', f: 'A-G', s: 'occupied' },
    { n: '103', t: 'DLX', f: 'A-G', s: 'available' },
    { n: '104', t: 'DLX', f: 'A-G', s: 'dirty' },
    { n: '105', t: 'SUI', f: 'A-G', s: 'available' },
    { n: '201', t: 'STD', f: 'A-2', s: 'available' },
    { n: '202', t: 'STD', f: 'A-2', s: 'occupied' },
    { n: '203', t: 'DLX', f: 'A-2', s: 'occupied' },
    { n: '204', t: 'DLX', f: 'A-2', s: 'available' },
    { n: '205', t: 'FAM', f: 'A-2', s: 'available' },
    { n: '301', t: 'STD', f: 'A-3', s: 'clean' },
    { n: '302', t: 'STD', f: 'A-3', s: 'available' },
    { n: '303', t: 'DLX', f: 'A-3', s: 'occupied' },
    { n: '304', t: 'SUI', f: 'A-3', s: 'available' },
    { n: '401', t: 'DLX', f: 'A-4', s: 'available' },
    { n: '402', t: 'DLX', f: 'A-4', s: 'occupied' },
    { n: '403', t: 'SUI', f: 'A-4', s: 'maintenance' },
    { n: '404', t: 'SUI', f: 'A-4', s: 'available' },
    { n: 'G01', t: 'STD', f: 'B-G', s: 'available' },
    { n: 'G02', t: 'STD', f: 'B-G', s: 'available' },
    { n: 'G03', t: 'FAM', f: 'B-G', s: 'occupied' },
    { n: 'B201', t: 'STD', f: 'B-2', s: 'available' },
    { n: 'B202', t: 'DLX', f: 'B-2', s: 'available' },
    { n: 'B203', t: 'FAM', f: 'B-2', s: 'dirty' }
  ]

  let created = 0
  for (const r of rooms) {
    const bCode = r.f.startsWith('A') ? 'A' : 'B'
    const { error } = await supabase
      .from('rooms')
      .upsert({
        room_number: r.n,
        room_type_id: roomTypeIds[r.t],
        floor_plan_id: floorIds[r.f],
        building_id: buildingIds[bCode],
        status: r.s
      }, { onConflict: 'room_number' })
    
    if (!error) {
      created++
      process.stdout.write(`\r✅ Created ${created}/${rooms.length} rooms`)
    }
  }

  console.log('\n\n🎉 Seeding complete!')
  console.log('Refresh Room Chart to see all rooms.')
}

seed().catch(console.error)
