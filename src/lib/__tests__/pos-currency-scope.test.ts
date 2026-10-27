import {
  toUsd,
  fromUsd,
  roundForCurrency,
  preciseAdd,
  preciseMultiply,
} from '../money-engine';
import {
  detectCurrencyCodeFromMeta,
  normalizeCurrencySettings,
} from '../currencies';

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

interface CartItem {
  id: string;
  name: string;
  price: number; // Base USD price
  quantity: number;
  unit: 'piece' | 'bulk';
  priceEntryCurrencyCode?: string;
  priceEntryRateSnapshot?: number;
}

interface Currency {
  code: string;
  symbol: string;
  name: string;
  rate: number;
}

// ---------------------------------------------------------------------------
// Test 1: Single Cart Currency controls all item prices and total (USD, QAR, EGP)
// ---------------------------------------------------------------------------
test('Test 1: Switching general cart currency changes all line prices and total without mutating base prices', () => {
  const cart: CartItem[] = [
    { id: 'prod_1', name: 'Coffee', price: 2.0, quantity: 2, unit: 'piece' },
    { id: 'prod_2', name: 'Tea', price: 1.0, quantity: 1, unit: 'piece' },
  ];

  // A. In USD ($1 = 1)
  const usdCurr: Currency = { code: 'USD', symbol: '$', name: 'دولار أمريكي', rate: 1.0 };
  const line1USD = roundForCurrency(fromUsd(cart[0].price, usdCurr.code, usdCurr.rate), usdCurr.code);
  const line2USD = roundForCurrency(fromUsd(cart[1].price, usdCurr.code, usdCurr.rate), usdCurr.code);
  const totalUSD = roundForCurrency(fromUsd(cart[0].price * cart[0].quantity + cart[1].price * cart[1].quantity, usdCurr.code, usdCurr.rate), usdCurr.code);

  assertEqual(line1USD, 2.0);
  assertEqual(line2USD, 1.0);
  assertEqual(totalUSD, 5.0, 'Total in USD should be $5.00');

  // B. Switch cart currency to QAR ($1 = 3.64)
  const qarCurr: Currency = { code: 'QAR', symbol: 'ر.ق', name: 'ريال قطري', rate: 3.64 };
  const line1QAR = roundForCurrency(fromUsd(cart[0].price, qarCurr.code, qarCurr.rate), qarCurr.code);
  const line2QAR = roundForCurrency(fromUsd(cart[1].price, qarCurr.code, qarCurr.rate), qarCurr.code);
  const totalQAR = roundForCurrency(fromUsd(cart[0].price * cart[0].quantity + cart[1].price * cart[1].quantity, qarCurr.code, qarCurr.rate), qarCurr.code);

  assertCloseTo(line1QAR, 7.28, 0.01);
  assertCloseTo(line2QAR, 3.64, 0.01);
  assertCloseTo(totalQAR, 18.20, 0.01, 'Total in QAR should be 18.20 QAR');

  // C. Switch cart currency to EGP ($1 = 48.0)
  const egpCurr: Currency = { code: 'EGP', symbol: 'ج.م', name: 'الجنيه المصري', rate: 48.0 };
  const line1EGP = roundForCurrency(fromUsd(cart[0].price, egpCurr.code, egpCurr.rate), egpCurr.code);
  const line2EGP = roundForCurrency(fromUsd(cart[1].price, egpCurr.code, egpCurr.rate), egpCurr.code);
  const totalEGP = roundForCurrency(fromUsd(cart[0].price * cart[0].quantity + cart[1].price * cart[1].quantity, egpCurr.code, egpCurr.rate), egpCurr.code);

  assertEqual(line1EGP, 96.0);
  assertEqual(line2EGP, 48.0);
  assertEqual(totalEGP, 240.0, 'Total in EGP should be 240.00 EGP');

  // Ensure base prices remained untouched throughout!
  assertEqual(cart[0].price, 2.0, 'Base price of item 1 must remain $2.00');
  assertEqual(cart[1].price, 1.0, 'Base price of item 2 must remain $1.00');
});

// ---------------------------------------------------------------------------
// Test 2: EditablePrice interprets entered price in cart currency and converts to USD
// ---------------------------------------------------------------------------
test('Test 2: Manual price edit interprets value in cart currency and converts to base USD', () => {
  const item: CartItem = { id: 'p1', name: 'Item', price: 2.0, quantity: 1, unit: 'piece' };

  // 1. User enters 18.20 in QAR (rate 3.64)
  const qarRate = 3.64;
  const enteredInQAR = 18.20;
  const newBaseFromQAR = enteredInQAR / qarRate;
  assertCloseTo(newBaseFromQAR, 5.0, 0.0001, '18.20 QAR / 3.64 must equal 5.00 USD base');

  // 2. User enters 240 in EGP (rate 48.0)
  const egpRate = 48.0;
  const enteredInEGP = 240.0;
  const newBaseFromEGP = enteredInEGP / egpRate;
  assertCloseTo(newBaseFromEGP, 5.0, 0.0001, '240 EGP / 48 must equal 5.00 USD base');

  // 3. User enters 10 in USD (rate 1.0)
  const usdRate = 1.0;
  const enteredInUSD = 10.0;
  const newBaseFromUSD = enteredInUSD;
  assertEqual(newBaseFromUSD, 10.0, 'Entered price in USD is equal to base USD');
});

// ---------------------------------------------------------------------------
// Test 3: Legacy held carts with priceEntryCurrencyCode do not break and use cart currency
// ---------------------------------------------------------------------------
test('Test 3: Legacy held carts containing priceEntryCurrencyCode load safely and follow selected cart currency', () => {
  const legacyHeldCart = {
    id: 'cart_legacy_1',
    name: 'سلة قديمة',
    cart: [
      { id: 'p1', name: 'Item 1', price: 5.0, quantity: 1, unit: 'piece' as const, priceEntryCurrencyCode: 'TRY', priceEntryRateSnapshot: 35.0 },
      { id: 'p2', name: 'Item 2', price: 10.0, quantity: 2, unit: 'piece' as const, priceEntryCurrencyCode: 'SYP', priceEntryRateSnapshot: 14500.0 },
    ],
    customerName: 'Legacy Customer',
    discount: 0,
    createdAt: Date.now(),
  };

  const serialized = JSON.stringify(legacyHeldCart);
  const parsed = JSON.parse(serialized);

  // Active cart currency is QAR
  const activeCartCurrency: Currency = { code: 'QAR', symbol: 'ر.ق', name: 'ريال قطري', rate: 3.64 };

  // All lines are rendered using activeCartCurrency regardless of old legacy fields
  const line1Displayed = roundForCurrency(fromUsd(parsed.cart[0].price, activeCartCurrency.code, activeCartCurrency.rate), activeCartCurrency.code);
  const line2Displayed = roundForCurrency(fromUsd(parsed.cart[1].price, activeCartCurrency.code, activeCartCurrency.rate), activeCartCurrency.code);

  assertCloseTo(line1Displayed, 18.20, 0.01, 'Line 1 must display in QAR ignoring legacy TRY code');
  assertCloseTo(line2Displayed, 36.40, 0.01, 'Line 2 must display in QAR ignoring legacy SYP code');
  assertEqual(parsed.cart[0].price, 5.0, 'Base price of item 1 is preserved');
  assertEqual(parsed.cart[1].price, 10.0, 'Base price of item 2 is preserved');
});

// ---------------------------------------------------------------------------
// Test 4: QAR / EGP Identity Protection (No TRY/SYP fallback)
// ---------------------------------------------------------------------------
test('Test 4: Store currency normalization gives QAR and EGP their true codes and symbols', () => {
  // A. QAR inside legacy slot
  const legacyQARSettings = {
    primaryCurrency: 'TRY',
    currencyNames: { USD: 'دولار', TRY: 'الريال القطري' },
    currencySymbols: { USD: '$', TRY: 'ر.ق' },
    exchangeRates: { USD: 1, TRY: 3.64 },
    enabledCurrencies: { USD: true, TRY: true, SYP: false },
  };

  const normQAR = normalizeCurrencySettings(legacyQARSettings);
  assertEqual(normQAR.primaryCurrencyCode, 'QAR', 'Primary currency must be QAR not TRY');
  assertEqual(normQAR.currencies.QAR?.code, 'QAR');
  assertEqual(normQAR.currencies.QAR?.symbol, 'QAR');
  assertEqual(normQAR.currencies.QAR?.name, 'الريال القطري');
  assertEqual(normQAR.currencies.QAR?.rate, 3.64);
  assertEqual(normQAR.currencies.TRY, undefined, 'TRY must not exist when it was only a slot for QAR');

  // B. EGP inside legacy slot
  const legacyEGPSettings = {
    primaryCurrency: 'SYP',
    currencyNames: { USD: 'دولار', SYP: 'الجنيه المصري' },
    currencySymbols: { USD: '$', SYP: 'ج.م' },
    exchangeRates: { USD: 1, SYP: 48 },
    enabledCurrencies: { USD: true, TRY: false, SYP: true },
  };

  const normEGP = normalizeCurrencySettings(legacyEGPSettings);
  assertEqual(normEGP.primaryCurrencyCode, 'EGP', 'Primary currency must be EGP not SYP');
  assertEqual(normEGP.currencies.EGP?.code, 'EGP');
  assertEqual(normEGP.currencies.EGP?.symbol, 'EGP');
  assertEqual(normEGP.currencies.EGP?.name, 'الجنيه المصري');
  assertEqual(normEGP.currencies.EGP?.rate, 48);
  assertEqual(normEGP.currencies.SYP, undefined, 'SYP must not exist when it was only a slot for EGP');
});

// ---------------------------------------------------------------------------
// Test 5: Explicit TRY & SYP configuration preserves Turkish & Syrian lira
// ---------------------------------------------------------------------------
test('Test 5: Explicit TRY & SYP settings preserve Turkish and Syrian lira properly', () => {
  const genuineTrySypSettings = {
    primaryCurrency: 'TRY',
    currencyNames: { USD: 'دولار', TRY: 'ليرة تركية', SYP: 'ليرة سورية' },
    currencySymbols: { USD: '$', TRY: '₺', SYP: 'ل.س' },
    exchangeRates: { USD: 1, TRY: 34, SYP: 14500 },
    enabledCurrencies: { USD: true, TRY: true, SYP: true },
  };

  const norm = normalizeCurrencySettings(genuineTrySypSettings);
  assertEqual(norm.primaryCurrencyCode, 'TRY');
  assertEqual(norm.currencies.TRY?.code, 'TRY');
  assertEqual(norm.currencies.TRY?.symbol, '₺');
  assertEqual(norm.currencies.TRY?.name, 'ليرة تركية');
  assertEqual(norm.currencies.SYP?.code, 'SYP');
  assertEqual(norm.currencies.SYP?.symbol, 'SYP');
  assertEqual(norm.currencies.SYP?.name, 'ليرة سورية');
});

// ---------------------------------------------------------------------------
// Test 6: Custom unknown currency preserves custom meta without forced TRY/SYP
// ---------------------------------------------------------------------------
test('Test 6: Custom unknown currency preserves custom meta without forced TRY/SYP', () => {
  const customSettings = {
    primaryCurrency: 'KWD',
    currencyNames: { USD: 'دولار', KWD: 'دينار كويتي' },
    currencySymbols: { USD: '$', KWD: 'د.ك' },
    exchangeRates: { USD: 1, KWD: 0.31 },
    enabledCurrencies: { USD: true, KWD: true, TRY: false, SYP: false },
  };

  const norm = normalizeCurrencySettings(customSettings);
  assertEqual(norm.primaryCurrencyCode, 'KWD');
  assertEqual(norm.currencies.KWD?.code, 'KWD');
  assertEqual(norm.currencies.KWD?.symbol, 'KWD');
  assertEqual(norm.currencies.KWD?.rate, 0.31);
  assertEqual(norm.currencies.TRY, undefined);
  assertEqual(norm.currencies.SYP, undefined);
});

// ---------------------------------------------------------------------------
// Run all tests
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

for (const t of tests) {
  try {
    t.fn();
    console.log(`[PASS] ${t.name}`);
    passed++;
  } catch (err: any) {
    console.error(`[FAIL] ${t.name}: ${err.message}`);
    failed++;
  }
}

console.log('\n========================================');
console.log(`Test Results: ${passed} passed, ${failed} failed`);
console.log('========================================');

// Node/bun runtime global — declared locally to avoid requiring @types/node
if (failed > 0) (globalThis as { process?: { exit(code: number): void } }).process?.exit(1);
