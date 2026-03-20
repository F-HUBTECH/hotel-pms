/**
 * Seed script for sample room data
 * Run with: npx ts-node --project tsconfig.json src/lib/db/seed-rooms.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function seedRooms() {
  console.log('🌱 Starting room data seeding...\n')

  // Get or create property
  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('code', 'MAIN')
    .maybeSingle()

  let propertyId = property?.id
  
  if (!propertyId) {
    console.log('Creating default property...')
    const { data: newProp } = await supabase
      .from('properties')
      .insert({ code: 'MAIN', name: 'Main Hotel', address: '123 Hotel St', city: 'Bangkok', country: 'Thailand', phone: '+6621234567', email: 'info@hotel.com', timezone: 'Asia/Bangkok', currency: 'THB' })
      .select()
      .single()
    propertyId = newProp?.id
    console.log('✅ Created property:', propertyId)
  }

  // Create Buildings
  const buildings = [
    { code: 'A', name: 'Building A - Main Tower' },
    { code: 'B', name: 'Building B - Garden Wing' },
  ]

  const buildingIds: Record<string, string> = {}
  
  for (const b of buildings) {
    const { data: existing } = await supabase.from('buildings').select('id').eq('property_id', propertyId).eq('code', b.code).maybeSingle()
    if (existing) {
      buildingIds[b.code] = existing.id
    } else {
      const { data } = await supabase.from('buildings').insert({ ...b, property_id: propertyId }).select().single()
      if (data) buildingIds[b.code] = data.id
    }
  }

  // Create Room Types
  const roomTypes = [
    { code: 'STD', name: 'Standard', description: 'Standard room', base_price: 1500 },
    { code: 'DLX', name: 'Deluxe', description: 'Deluxe room', base_price: 2500 },
    { code: 'SUI', name: 'Suite', description: 'Suite room', base_price: 4500 },
    { code: 'FAM', name: 'Family', description: 'Family room', base_price: 3500 },
  ]

  const roomTypeIds: Record<string, string> = {}
  
  for (const rt of roomTypes) {
    const { data: existing } = await supabase.from('room_types').select('id').eq('code', rt.code).maybeSingle()
    if (existing) {
      roomTypeIds[rt.code] = existing.id
    } else {
      const { data } = await supabase.from('room_types').insert(rt).select().single()
      if (data) roomTypeIds[rt.code] = data.id
    }
  }

  // Create Floors
  const floors = [
    { code: 'G', name: 'Ground', b: 'A' },
    { code: '2', name: '2nd', b: 'A' },
    { code: '3', name: '3rd', b: 'A' },
    { code: '4', name: '4th', b: 'A' },
    { code: 'G', name: 'Ground', b: 'B' },
    { code: '2', name: '2nd', b: 'B' },
  ]

  const floorIds: Record<string, string> = {}
  
  for (const f of floors) {
    const key = f.b + '-' + f.code
    const bId = buildingIds[f.b]
    const { data: existing } = await supabase.from('floor_plans').select('id').eq('building_id', bId).eq('code', f.code).maybeSingle()
    if (existing) {
      floorIds[key] = existing.id
    } else {
      const { data } = await supabase.from('floor_plans').insert({ code: f.code, name: f.name, building_id: bId }).select().single()
      if (data) floorIds[key] = data.id
    }
  }

  // Create Rooms
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
    { n: 'B203', t: 'FAM', f: 'B-2', s: 'dirty' },
  ]

  let created = 0
  for (const r of rooms) {
    const { data: existing } = await supabase.from('rooms').select('id').eq('room_number', r.n).maybeSingle()
    if (!existing) {
      await supabase.from('rooms').insert({
        room_number: r.n,
        room_type_id: roomTypeIds[r.t],
        floor_plan_id: floorIds[r.f],
        building_id: r.f.startsWith('A') ? buildingIds['A'] : buildingIds['B'],
        status: r.s,
      })
      created++
      console.log(`✅ Created room ${r.n}`)
    }
  }

  console.log(`\n🎉 Done! Created ${created} rooms`)
}

seedRooms().catch(console.error)
