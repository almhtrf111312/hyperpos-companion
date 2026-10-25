import {
  toUsd,
  fromUsd,
  round8,
  roundForCurrency,
  preciseAdd,
  preciseSubtract,
  preciseMultiply,
  preciseDivide,
  formatSnapshot,
  getCurrencyDef,
} from '../money-engine';

interface TestCase {
  name: string;
  fn: () => void;
}

const tests: TestCase[] = [];
function test(name: string, fn: () => void) {
  tests.push({ name, fn });
}

function assertEqual(actual: any, expected: any, msg?: string) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: expected ${expected}, got ${actual}${msg ? ' - ' + msg : ''}`);
  }
}

function assertCloseTo(actual: number, expected: number, delta: number = 0.0001, msg?: string) {
  if (Math.abs(actual - expected) > delta) {
    throw new Error(`Assertion failed: expected ${expected} ± ${delta}, got ${actual}${msg ? ' - ' + msg : ''}`);
  }
}

// -------------------------------------------------------------
// Test 1: Critical Acceptance Test (1.00 QAR at rate 3.64)
// -------------------------------------------------------------
test('Test 1: 1.00 QAR at exchange rate 3.64 remains 1.00 QAR end-to-end', () => {
  const rate = 3.64;
  const inputQAR = 1.00;

  // Step 1: to USD (product price stored)
  const usdPrice = toUsd(inputQAR, 'QAR', rate);
  assertCloseTo(usdPrice, 0.27472527, 0.0000001, 'USD price should have 8 decimal precision');

  // Step 2: Intermediate line calculations (quantity = 1)
  const lineAmountUSD = preciseMultiply(usdPrice, 1);
  const subtotalUSD = lineAmountUSD;
  const totalUSD = subtotalUSD;

  // Step 3: Convert back to QAR for display and collectible settlement
  const convertedQAR = fromUsd(totalUSD, 'QAR', rate);
  const finalCollectibleQAR = roundForCurrency(convertedQAR, 'QAR');

  assertEqual(finalCollectibleQAR, 1.00, 'Final QAR amount must be 1.00, not 0.98');
});

// -------------------------------------------------------------
// Test 2: 3-decimal currency (KWD: 1.234 KWD at rate 0.31)
// -------------------------------------------------------------
test('Test 2: 1.234 KWD at exchange rate 0.31 preserves all 3 decimal places', () => {
  const rate = 0.31;
  const inputKWD = 1.234;

  const usdPrice = toUsd(inputKWD, 'KWD', rate);
  assertCloseTo(usdPrice, 3.98064516, 0.0000001, 'USD price must preserve 8 decimals');

  const lineTotalUSD = preciseMultiply(usdPrice, 1);
  const totalUSD = lineTotalUSD;

  const convertedKWD = fromUsd(totalUSD, 'KWD', rate);
  const finalCollectibleKWD = roundForCurrency(convertedKWD, 'KWD');

  assertEqual(finalCollectibleKWD, 1.234, 'KWD must not truncate 3rd decimal place');
});

// -------------------------------------------------------------
// Test 3: Zero-decimal currency (SYP: 25,000 SYP at rate 14,500)
// -------------------------------------------------------------
test('Test 3: 25,000 SYP at exchange rate 14500 remains 25000 with 0 decimals', () => {
  const rate = 14500;
  const inputSYP = 25000;

  const usdPrice = toUsd(inputSYP, 'SYP', rate);
  assertCloseTo(usdPrice, 1.72413793, 0.0000001);

  const convertedSYP = fromUsd(usdPrice, 'SYP', rate);
  const finalCollectibleSYP = roundForCurrency(convertedSYP, 'SYP');

  assertEqual(finalCollectibleSYP, 25000, 'SYP must be an exact integer without fractional drift');
});

// -------------------------------------------------------------
// Test 4: Multiple fractional items + discount + tax
// -------------------------------------------------------------
test('Test 4: Fractional items with percent discount and tax retain consistent math', () => {
  const rate = 3.64; // QAR
  // Item 1: 2.5 kg at 10.50 QAR/kg
  const price1USD = toUsd(10.50, 'QAR', rate);
  const line1USD = preciseMultiply(price1USD, 2.5);

  // Item 2: 1.75 kg at 4.20 QAR/kg
  const price2USD = toUsd(4.20, 'QAR', rate);
  const line2USD = preciseMultiply(price2USD, 1.75);

  const subtotalUSD = preciseAdd(line1USD, line2USD);

  // 10% discount
  const discountUSD = round8((subtotalUSD * 10) / 100);
  const taxableUSD = preciseSubtract(subtotalUSD, discountUSD);

  // 5% tax (net)
  const taxUSD = round8((taxableUSD * 5) / 100);
  const totalUSD = preciseAdd(taxableUSD, taxUSD);

  // Convert each component to QAR
  const subtotalQAR = roundForCurrency(fromUsd(subtotalUSD, 'QAR', rate), 'QAR');
  const discountQAR = roundForCurrency(fromUsd(discountUSD, 'QAR', rate), 'QAR');
  const taxQAR = roundForCurrency(fromUsd(taxUSD, 'QAR', rate), 'QAR');
  const totalQAR = roundForCurrency(fromUsd(totalUSD, 'QAR', rate), 'QAR');

  // Verify subtotal QAR = 2.5 * 10.50 + 1.75 * 4.20 = 26.25 + 7.35 = 33.60
  assertEqual(subtotalQAR, 33.60, 'Subtotal in QAR should match exact arithmetic');
  // Discount 10% = 3.36
  assertEqual(discountQAR, 3.36, 'Discount in QAR should match 10% of subtotal');
  // Taxable = 30.24, Tax 5% = 1.512 -> 1.51
  assertEqual(taxQAR, 1.51, 'Tax in QAR should match 5% of taxable');
  // Total = 30.24 + 1.512 = 31.752 -> 31.75
  assertEqual(totalQAR, 31.75, 'Total in QAR should round accurately according to currency rules');
});

// -------------------------------------------------------------
// Test 5: Historical snapshot preservation vs store rate update
// -------------------------------------------------------------
test('Test 5: Invoice retains historical snapshot rate and does not drift when store rate changes', () => {
  const historicalRate = 3.64;
  const inputQAR = 1.00;
  const totalUSD = toUsd(inputQAR, 'QAR', historicalRate); // ~0.27472527

  // Store settings changed later to 4.00
  const snapshot = {
    currency_code: 'QAR',
    currency_symbol: 'ر.ق',
    exchange_rate: historicalRate,
  };

  const formatted = formatSnapshot(totalUSD, snapshot);
  // Must render using historicalRate 3.64 -> 1.00 ر.ق
  assertEqual(formatted.includes('1.00'), true, `Snapshot formatted text '${formatted}' must show 1.00`);
});

// -------------------------------------------------------------
// Test 6: Composite / Deferred down payment and remaining debt
// -------------------------------------------------------------
test('Test 6: Downpayment and remaining debt preserve unity and currency decimals', () => {
  const rate = 3.64;
  const totalUSD = toUsd(100.00, 'QAR', rate); // 100 QAR
  const receivedUSD = toUsd(30.00, 'QAR', rate); // 30 QAR

  const downPaymentUSD = round8(Math.max(0, Math.min(receivedUSD, totalUSD)));
  const remainingDebtUSD = round8(totalUSD - downPaymentUSD);

  const downPaymentQAR = roundForCurrency(fromUsd(downPaymentUSD, 'QAR', rate), 'QAR');
  const remainingDebtQAR = roundForCurrency(fromUsd(remainingDebtUSD, 'QAR', rate), 'QAR');
  const totalQAR = roundForCurrency(fromUsd(totalUSD, 'QAR', rate), 'QAR');

  assertEqual(downPaymentQAR, 30.00, 'Downpayment in QAR should be 30.00');
  assertEqual(remainingDebtQAR, 70.00, 'Remaining debt in QAR should be 70.00');
  assertEqual(downPaymentQAR + remainingDebtQAR, totalQAR, 'Downpayment + remaining debt must equal total in QAR');
});

// -------------------------------------------------------------
// Run all tests
// -------------------------------------------------------------
let passed = 0;
let failed = 0;

for (const t of tests) {
  try {
    t.fn();
    console.log(`[PASS] ${t.name}`);
    passed++;
  } catch (err: any) {
    console.error(`[FAIL] ${t.name}`);
    console.error(`       Error: ${err.message}`);
    failed++;
  }
}

console.log(`\n========================================`);
console.log(`Test Results: ${passed} passed, ${failed} failed`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
}
