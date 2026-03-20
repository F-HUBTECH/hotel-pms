/**
 * VAT and Service Charge Calculation Tests
 * Validates against KFO legacy formulas (Thai standards)
 */

// ─────────────────────────────────────────────
// KFO VAT Calculation Formulas (Thai Standards)
// ─────────────────────────────────────────────

/**
 * Type A: VAT Inclusive (Thailand Standard)
 * Amount already includes VAT + Service Charge
 */
function calculateVATTypeA(gross, vatRate = 7.00, servRate = 10.00) {
  // VAT Amount
  const vatAmount = Math.round((gross * vatRate) / (100 + vatRate) * 100) / 100;

  // Service Amount (from pre-VAT amount)
  const servAmount = Math.round((gross * servRate) / (100 + vatRate + servRate) * 100) / 100;

  // Net Amount (before VAT and Service)
  const netAmount = gross - vatAmount - servAmount;

  return {
    gross,
    netAmount,
    vatAmount,
    servAmount,
    vatRate,
    servRate,
    vatableAmount: gross,
    nonVatAmount: 0,
  };
}

/**
 * Type B: VAT Exclusive
 * VAT and Service Charge added on top of net amount
 */
function calculateVATTypeB(net, vatRate = 7.00, servRate = 10.00) {
  // Service Amount
  const servAmount = Math.round((net * servRate) / 100 * 100) / 100;

  // VAT Amount (on net + service)
  const vatAmount = Math.round(((net + servAmount) * vatRate) / 100 * 100) / 100;

  // Gross Amount (net + VAT + Service)
  const gross = net + vatAmount + servAmount;

  return {
    gross,
    netAmount: net,
    vatAmount,
    servAmount,
    vatRate,
    servRate,
    vatableAmount: net,
    nonVatAmount: 0,
  };
}

/**
 * Non-VAT Item
 * No VAT or Service Charge applied
 */
function calculateNonVAT(amount) {
  return {
    gross: amount,
    netAmount: amount,
    vatAmount: 0,
    servAmount: 0,
    vatRate: 0,
    servRate: 0,
    vatableAmount: 0,
    nonVatAmount: amount,
  };
}

// ─────────────────────────────────────────────
// Test Cases
// ─────────────────────────────────────────────

const testCases = [
  // Type A - Standard Hotel Rates
  {
    description: "Type A - 1,000 THB with 7% VAT, 10% SC",
    input: { amount: 1000, vatRate: 7, servRate: 10, type: "A" },
    expected: {
      vatAmount: 65.42,
      servAmount: 85.47,
      netAmount: 849.11,
    },
  },
  {
    description: "Type A - 500 THB with 7% VAT, 10% SC",
    input: { amount: 500, vatRate: 7, servRate: 10, type: "A" },
    expected: {
      vatAmount: 32.71,
      servAmount: 42.74,
      netAmount: 424.55,
    },
  },
  {
    description: "Type A - 2,500 THB with 7% VAT, 10% SC",
    input: { amount: 2500, vatRate: 7, servRate: 10, type: "A" },
    expected: {
      vatAmount: 163.55,
      servAmount: 213.68,
      netAmount: 2122.77,
    },
  },

  // Type B - VAT Exclusive
  {
    description: "Type B - 1,000 THB with 7% VAT, 10% SC",
    input: { amount: 1000, vatRate: 7, servRate: 10, type: "B" },
    expected: {
      vatAmount: 77.00,
      servAmount: 100.00,
      gross: 1177.00,
    },
  },
  {
    description: "Type B - 500 THB with 7% VAT, 10% SC",
    input: { amount: 500, vatRate: 7, servRate: 10, type: "B" },
    expected: {
      vatAmount: 38.50,
      servAmount: 50.00,
      gross: 588.50,
    },
  },

  // Edge Cases
  {
    description: "Zero VAT - 1,000 THB with 0% VAT, 10% SC",
    input: { amount: 1000, vatRate: 0, servRate: 10, type: "A" },
    expected: {
      vatAmount: 0,
      servAmount: 90.91,
      netAmount: 909.09,
    },
  },
  {
    description: "Zero Service Charge - 1,000 THB with 7% VAT, 0% SC",
    input: { amount: 1000, vatRate: 7, servRate: 0, type: "A" },
    expected: {
      vatAmount: 65.42,
      servAmount: 0,
      netAmount: 934.58,
    },
  },
  {
    description: "Non-VAT Item - Late Check-out",
    input: { amount: 500, vatRate: 0, servRate: 0, type: "N" },
    expected: {
      vatAmount: 0,
      servAmount: 0,
      netAmount: 500,
      nonVatAmount: 500,
    },
  },

  // Real Hotel Scenarios
  {
    description: "Room Rate - 3,500 THB (Type A)",
    input: { amount: 3500, vatRate: 7, servRate: 10, type: "A" },
    expected: {
      vatAmount: 228.97,
      servAmount: 299.15,
      netAmount: 2971.88,
    },
  },
  {
    description: "Mini Bar - 350 THB (Type A)",
    input: { amount: 350, vatRate: 7, servRate: 10, type: "A" },
    expected: {
      vatAmount: 22.90,
      servAmount: 29.91,
      netAmount: 297.19,
    },
  },
  {
    description: "Laundry - 800 THB (Type A)",
    input: { amount: 800, vatRate: 7, servRate: 10, type: "A" },
    expected: {
      vatAmount: 52.34,
      servAmount: 68.38,
      netAmount: 679.28,
    },
  },
];

// ─────────────────────────────────────────────
// Run Tests
// ─────────────────────────────────────────────

function runTests() {
  console.log("=== VAT/Service Charge Calculation Tests ===\n");

  let passed = 0;
  let failed = 0;

  testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.description}`);
    console.log(`Input:`, testCase.input);

    let result;
    if (testCase.input.type === "A") {
      result = calculateVATTypeA(
        testCase.input.amount,
        testCase.input.vatRate,
        testCase.input.servRate
      );
    } else if (testCase.input.type === "B") {
      result = calculateVATTypeB(
        testCase.input.amount,
        testCase.input.vatRate,
        testCase.input.servRate
      );
    } else if (testCase.input.type === "N") {
      result = calculateNonVAT(testCase.input.amount);
    }

    console.log(`Result:`, {
      VAT: result.vatAmount,
      SC: result.servAmount,
      Net: result.netAmount,
      Gross: result.gross,
    });
    console.log(`Expected:`, testCase.expected);

    // Check if results match expected
    let match = true;
    Object.keys(testCase.expected).forEach((key) => {
      const expected = testCase.expected[key];
      const actual = result[key];
      if (Math.abs(actual - expected) > 0.01) {
        match = false;
        console.log(`❌ Mismatch ${key}: expected ${expected}, got ${actual}`);
      }
    });

    if (match) {
      console.log("✅ PASSED\n");
      passed++;
    } else {
      console.log("❌ FAILED\n");
      failed++;
    }
  });

  console.log("=== Summary ===");
  console.log(`Total: ${testCases.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%`);
}

// Run the tests
runTests();
