import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

// Load environment variables manually since this is a script outside Next.js context
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing Next.js Supabase Environment Variables!')
    console.error('Usage: NEXT_PUBLIC_SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." npx tsx scripts/migrate_kfo.ts')
    process.exit(1)
}

// Service role client bypasses RLS for migration
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

interface MigrationMap {
    source_system: string
    target_system: string
    table_mappings: Record<string, any>
    default_values: Record<string, any>
}

// In-memory lookup tables tracking old KFO IDs -> new Supabase UUIDs
const legacyIdMaps: Record<string, Map<string, string>> = {
    GUEST_PROFILE: new Map(),
    RESERVATIONS: new Map(),
    FOLIO_MASTER: new Map()
}

// Simple CSV parser
function parseRow(line: string): string[] {
    const result: string[] = []
    let inQuotes = false
    let currentPart = ''
    for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
            inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
            result.push(currentPart)
            currentPart = ''
        } else {
            currentPart += char
        }
    }
    result.push(currentPart)
    return result
}

async function processTable(tableName: string, mapConfig: any, dataDir: string) {
    console.log(`\n--- Migrating KFO Table: ${tableName} ---`)
    const csvPath = path.join(dataDir, `${tableName}.csv`)

    if (!fs.existsSync(csvPath)) {
        console.warn(`[WARNING] Data file not found: ${csvPath}. Skipping ${tableName}...`)
        return
    }

    const { target_table, fields } = mapConfig
    const fileStream = fs.createReadStream(csvPath)
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity })

    let isHeader = true
    let headers: string[] = []
    const batchData: any[] = []
    const BATCH_SIZE = 100
    let totalProcessed = 0

    // Fetch master data mapping for lookups (like Room Types -> UUIDs)
    console.log(`Reading ${tableName}.csv...`)

    for await (const line of rl) {
        if (!line.trim()) continue
        const rowData = parseRow(line)

        if (isHeader) {
            headers = rowData.map(h => h.trim())
            isHeader = false
            continue
        }

        const legacyRow: Record<string, string> = {}
        headers.forEach((h, i) => { legacyRow[h] = rowData[i]?.trim() || '' })

        // Apply mapping
        const newRecord: any = {}
        let skipRecord = false

        for (const [legacyField, mapping] of Object.entries(fields)) {
            const rawValue = legacyRow[legacyField]

            if (typeof mapping === 'string') {
                newRecord[mapping] = rawValue
            } else {
                const mapDef = mapping as any
                switch (mapDef.type) {
                    case 'transform':
                        newRecord[mapDef.target_field] = mapDef.transform_map[rawValue] || rawValue
                        break
                    case 'lookup_legacy':
                        const mapName = mapDef.lookup_map
                        const newId = legacyIdMaps[mapName]?.get(rawValue)
                        if (newId) {
                            newRecord[mapDef.target_field] = newId
                        } else {
                            console.warn(`[WARNING] Missing legacy relation for ${mapName} ID: ${rawValue}`)
                            skipRecord = true
                        }
                        break
                    case 'lookup':
                        // Fallback lookup implementation (to be cached in production)
                        // Mocking static data resolution for simplicity right now
                        newRecord[mapDef.target_field] = rawValue // normally resolver function
                        break
                }
            }
        }

        if (skipRecord) continue

        // Assign common default values needed
        const defaultValues = JSON.parse(fs.readFileSync(path.join(__dirname, 'migration_map.json'), 'utf-8')).default_values
        if (target_table === 'reservations' || target_table === 'folios') {
            // newRecord['property_id'] = defaultValues.property_id
        }

        batchData.push(newRecord)

        if (batchData.length >= BATCH_SIZE) {
            await insertBatch(target_table, batchData, tableName, headers[0], legacyRow[headers[0]])
            totalProcessed += batchData.length
            batchData.length = 0
            console.log(`Inserted ${totalProcessed} records into ${target_table}...`)
        }
    }

    // Insert remaining
    if (batchData.length > 0) {
        await insertBatch(target_table, batchData, tableName, headers[0], 'FINAL')
        totalProcessed += batchData.length
        console.log(`Inserted ${totalProcessed} records into ${target_table}...`)
    }
}

async function insertBatch(target_table: string, batch: any[], legacyTable: string, legacyPkStr: string, sampleLegacyPk: string) {
    const { data, error } = await supabase
        .from(target_table)
        .insert(batch)
        .select()

    if (error) {
        console.error(`ERROR inserting into ${target_table}:`, error.message)
    } else if (data && data.length > 0) {
        // Build map from legacy ID to new UUID if applicable
        if (legacyIdMaps[legacyTable]) {
            // Data insertion typically returns records in order, but we can't guarantee 1-to-1 without external IDs.
            // For production migrations, the Supabase schema *must* have an 'external_legacy_id' column for robust mapping.
            // Assuming here we added 'external_id' implicitly or simply mock the mapping for demo purposes.
            data.forEach((row, i) => {
                const mockLegacyId = batch[i][legacyPkStr] || `MOCK-${i}`
                legacyIdMaps[legacyTable].set(mockLegacyId, row.id)
            })
        }
    }
}

async function main() {
    console.log('=== STARTING KFO TO NEXTJS PMS MIGRATION ===')
    const mapFile = fs.readFileSync(path.join(__dirname, 'migration_map.json'), 'utf-8')
    const mapConfig: MigrationMap = JSON.parse(mapFile)

    const dataDir = path.join(__dirname, '..', 'data_export')
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir)
        console.log(`Created ${dataDir}. Please place KFO CSV exports there (GUEST_PROFILE.csv, RESERVATIONS.csv, etc.)`)
        return
    }

    // Process systematically respecting foreign key sequences
    const ordering = ['GUEST_PROFILE', 'RESERVATIONS', 'FOLIO_MASTER', 'FOLIO_TRANS']

    for (const tableName of ordering) {
        if (mapConfig.table_mappings[tableName]) {
            await processTable(tableName, mapConfig.table_mappings[tableName], dataDir)
        }
    }

    console.log('\n=== MIGRATION COMPLETE ===')
}

main().catch(console.error)
