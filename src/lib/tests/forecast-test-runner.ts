/**
 * Hotel PMS - Forecast Test Runner
 * Phase 8: Testing & Validation
 * Comprehensive test suite for forecast system
 */

import {
  testForecastGeneration,
  testManualAdjustments,
  testRoomStatusUpdates,
  testFITGRPBreakdown,
  testComparisonReports,
  testHotelPMSValidation,
} from './forecast-tests'

// =============================================
// TEST RUNNER
// =============================================

export interface TestResult {
  testName: string
  passed: boolean
  duration: number
  error?: string
  details?: any
}

export interface TestSuiteResult {
  suiteName: string
  tests: TestResult[]
  passed: number
  failed: number
  duration: number
}

export class ForecastTestRunner {
  private results: TestSuiteResult[] = []

  async runAllTests(): Promise<{
    totalSuites: number
    totalTests: number
    totalPassed: number
    totalFailed: number
    totalDuration: number
    results: TestSuiteResult[]
  }> {
    console.log('🧪 Starting Forecast System Test Suite...\n')

    const suites = [
      await this.runSuite('Forecast Generation', testForecastGeneration),
      await this.runSuite('Manual Adjustments', testManualAdjustments),
      await this.runSuite('Room Status Updates', testRoomStatusUpdates),
      await this.runSuite('FIT vs GRP Breakdown', testFITGRPBreakdown),
      await this.runSuite('Comparison Reports', testComparisonReports),
      await this.runSuite('Hotel PMS Validation', testHotelPMSValidation),
    ]

    const totalTests = suites.reduce((sum, s) => sum + s.tests.length, 0)
    const totalPassed = suites.reduce((sum, s) => sum + s.passed, 0)
    const totalFailed = suites.reduce((sum, s) => sum + s.failed, 0)
    const totalDuration = suites.reduce((sum, s) => sum + s.duration, 0)

    console.log('\n' + '='.repeat(60))
    console.log('📊 TEST SUMMARY')
    console.log('='.repeat(60))
    console.log(`Total Suites: ${suites.length}`)
    console.log(`Total Tests: ${totalTests}`)
    console.log(`Passed: ${totalPassed}`)
    console.log(`Failed: ${totalFailed}`)
    console.log(`Duration: ${totalDuration}ms`)
    console.log('='.repeat(60))

    return {
      totalSuites: suites.length,
      totalTests,
      totalPassed,
      totalFailed,
      totalDuration,
      results: suites,
    }
  }

  private async runSuite(
    suiteName: string,
    tests: () => Promise<TestResult[]>
  ): Promise<TestSuiteResult> {
    console.log(`\n📦 Running: ${suiteName}`)
    console.log('-'.repeat(40))

    const startTime = Date.now()
    const testResults = await tests()
    const duration = Date.now() - startTime

    const passed = testResults.filter(t => t.passed).length
    const failed = testResults.filter(t => !t.passed).length

    console.log(`\n✓ Passed: ${passed} | ✗ Failed: ${failed} | Time: ${duration}ms`)

    const suiteResult: TestSuiteResult = {
      suiteName,
      tests: testResults,
      passed,
      failed,
      duration,
    }

    this.results.push(suiteResult)
    return suiteResult
  }

  printDetailedResults() {
    console.log('\n' + '='.repeat(80))
    console.log('📝 DETAILED TEST RESULTS')
    console.log('='.repeat(80))

    this.results.forEach(suite => {
      console.log(`\n📦 ${suite.suiteName}`)
      console.log('-'.repeat(80))

      suite.tests.forEach(test => {
        const icon = test.passed ? '✓' : '✗'
        const status = test.passed ? 'PASS' : 'FAIL'
        const color = test.passed ? '\x1b[32m' : '\x1b[31m' // green or red

        console.log(`${color}${icon}\x1b[0m [${status}] ${test.testName} (${test.duration}ms)`)

        if (!test.passed && test.error) {
          console.log(`  Error: ${test.error}`)
        }

        if (test.details) {
          console.log(`  Details:`, test.details)
        }
      })
    })

    console.log('\n' + '='.repeat(80))
  }

  generateReport(): string {
    let report = '# Forecast System Test Report\n\n'
    report += `Generated: ${new Date().toISOString()}\n\n`

    // Summary
    const totalTests = this.results.reduce((sum, s) => sum + s.tests.length, 0)
    const totalPassed = this.results.reduce((sum, s) => sum + s.passed, 0)
    const totalFailed = this.results.reduce((sum, s) => sum + s.failed, 0)
    const passRate = ((totalPassed / totalTests) * 100).toFixed(1)

    report += '## Summary\n\n'
    report += `- Total Tests: ${totalTests}\n`
    report += `- Passed: ${totalPassed}\n`
    report += `- Failed: ${totalFailed}\n`
    report += `- Pass Rate: ${passRate}%\n\n`

    // Suite Results
    report += '## Test Suites\n\n'
    this.results.forEach(suite => {
      report += `### ${suite.suiteName}\n\n`
      report += `- Tests: ${suite.tests.length}\n`
      report += `- Passed: ${suite.passed}\n`
      report += `- Failed: ${suite.failed}\n`
      report += `- Duration: ${suite.duration}ms\n\n`

      report += '| Test | Status | Duration (ms) |\n'
      report += '|------|--------|----------------|\n'

      suite.tests.forEach(test => {
        const status = test.passed ? '✓ PASS' : '✗ FAIL'
        report += `| ${test.testName} | ${status} | ${test.duration} |\n`
      })

      report += '\n'
    })

    return report
  }
}

// =============================================
// INDIVIDUAL TESTS
// =============================================

export async function runIndividualTest(
  testName: string,
  testFunction: () => Promise<boolean | { passed: boolean; details?: any }>
): Promise<TestResult> {
  const startTime = Date.now()

  try {
    const result = await testFunction()
    const passed = typeof result === 'boolean' ? result : result.passed
    const details = typeof result === 'boolean' ? undefined : result.details

    return {
      testName,
      passed,
      duration: Date.now() - startTime,
      details,
    }
  } catch (error) {
    return {
      testName,
      passed: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// =============================================
// MOCK DATA GENERATORS
// =============================================

export function generateMockRoomData(count: number = 10) {
  return Array.from({ length: count }, (_, i) => ({
    room_number: `${(i + 1).toString().padStart(3, '0')}`,
    room_type: i % 4 === 0 ? 'Suite' : i % 3 === 0 ? 'Deluxe' : 'Standard',
    building_id: '1',
    floor: Math.floor(i / 3) + 1,
  }))
}

export function generateMockReservationData(count: number = 20) {
  const rooms = generateMockRoomData(10)
  const today = new Date()

  return Array.from({ length: count }, (_, i) => {
    const room = rooms[i % rooms.length]
    const checkIn = new Date(today)
    checkIn.setDate(today.getDate() + i)

    const checkOut = new Date(checkIn)
    checkOut.setDate(checkIn.getDate() + Math.floor(Math.random() * 5) + 1)

    return {
      reservation_number: `RES${(i + 1).toString().padStart(6, '0')}`,
      room_number: room.room_number,
      room_type: room.room_type,
      check_in_date: checkIn.toISOString().split('T')[0],
      check_out_date: checkOut.toISOString().split('T')[0],
      guest_type: i % 3 === 0 ? 'GRP' : 'FIT',
      adult_count: Math.floor(Math.random() * 2) + 1,
      child_count: Math.floor(Math.random() * 2),
      rate_amount: Math.floor(Math.random() * 2000) + 1000,
      status: 'confirmed',
    }
  })
}

export function generateMockForecastData(days: number = 30, rooms: number = 10) {
  const today = new Date()

  return Array.from({ length: days }, (_, i) => {
    const date = new Date(today)
    date.setDate(today.getDate() + i)

    return {
      forecast_date: date.toISOString().split('T')[0],
      total_rooms: rooms,
      occupied_rooms: Math.floor(rooms * (0.5 + Math.random() * 0.4)),
      stayover_rooms: Math.floor(rooms * 0.3),
      arrival_rooms: Math.floor(rooms * 0.2),
      departure_rooms: Math.floor(rooms * 0.2),
      occupancy_percentage: (50 + Math.random() * 40),
      total_revenue: Math.floor(rooms * 1500 * (0.5 + Math.random() * 0.4)),
      room_revenue: Math.floor(rooms * 1200 * (0.5 + Math.random() * 0.4)),
      extra_revenue: Math.floor(rooms * 300 * Math.random()),
      fit_revenue: Math.floor(rooms * 1500 * (0.5 + Math.random() * 0.4) * 0.7),
      grp_revenue: Math.floor(rooms * 1500 * (0.5 + Math.random() * 0.4) * 0.3),
      adr: 1200 + Math.floor(Math.random() * 500),
      revpar: 600 + Math.floor(Math.random() * 400),
    }
  })
}

// =============================================
// VALIDATION HELPERS
// =============================================

export function validateHotelPMSColorParity(
  status: string,
  kfoColor: string
): { matches: boolean; expected: string; actual: string } {
  const kfoColors: Record<string, string> = {
    available: 'white with green border',
    occupied_fit: 'blue',
    occupied_grp: 'purple',
    occupied_house: 'orange',
    oo: 'gray',
    oi: 'gray (darker)',
    hu: 'light orange',
    override: 'yellow',
  }

  return {
    matches: kfoColor.includes(status) || status.includes(kfoColor),
    expected: kfoColors[status] || 'unknown',
    actual: kfoColor,
  }
}

export function validateRevenueCalculation(
  roomRevenue: number,
  extraRevenue: number,
  expectedTotal: number
): { valid: boolean; variance: number; withinThreshold: boolean } {
  const calculatedTotal = roomRevenue + extraRevenue
  const variance = Math.abs(calculatedTotal - expectedTotal)
  const withinThreshold = variance <= 0.01 // Allow 1 satang difference

  return {
    valid: withinThreshold,
    variance,
    withinThreshold,
  }
}

export function validateOccupancyCalculation(
  occupiedRooms: number,
  totalRooms: number,
  occupancyPercentage: number
): { valid: boolean; expected: number; actual: number } {
  const expected = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0
  const actual = occupancyPercentage
  const variance = Math.abs(expected - actual)
  const valid = variance <= 0.1 // Allow 0.1% difference

  return {
    valid,
    expected: Math.round(expected * 10) / 10,
    actual: Math.round(actual * 10) / 10,
  }
}
