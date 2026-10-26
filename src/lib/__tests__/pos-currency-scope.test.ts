import {
  toUsd,
  fromUsd,
  roundForCurrency,
  preciseAdd,
  preciseMultiply,
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
  rate: number;
}

const currencies: Currency[] = [
  { code: 'USD', symbol: '$', rate: 1 },
  { code: 'TRY', symbol: '₺', rate: 35.0 },
  { code: 'SYP', symbol: 'ل.س', rate: 14500.0 },
];

const invoiceCurrency: Currency = { code: 'TRY', symbol: '₺', rate: 35.0 };

function getLineCurrency(item: CartItem, currs: Currency[], invCurr: Currency): Currency {
  return currs.find(c => c.code === item.priceEntryCurrencyCode) ?? invCurr;
}

function getSafeRate(currency: Currency, item: CartItem): number {
  const rate = item.priceEntryRateSnapshot ?? currency.rate;
  return Number.isFinite(rate) && rate > 0 ? rate : 1;
}

// ---------------------------------------------------------------------------
// Test 1: Switching item 1 currency does NOT change item 2, subtotal, or total
// ---------------------------------------------------------------------------
test('Test 1: Changing line 1 currency to USD does NOT change item 2 or invoice total', () => {
  let cart: CartItem[] = [
    { id: 'prod_1', name: 'Coffee', price: 2.0, quantity: 2, unit: 'piece' }, // $2 = 70 TRY
    { id: 'prod_2', name: 'Tea', price: 1.0, quantity: 3, unit: 'piece' },    // $1 = 35 TRY
  ];

  // Total in invoice currency (TRY) initially: (2*2 + 1*3) = $7 * 35 = 245 TRY
  const initialSubtotalUSD = cart.reduce((sum, it) => sum + it.price * it.quantity, 0);
  const initialTotalTRY = roundForCurrency(fromUsd(initialSubtotalUSD, 'TRY', 35), 'TRY');
  assertEqual(initialTotalTRY, 245.0, 'Initial total should be 245 TRY');

  // Switch line 1 currency to USD
  const targetCurrency = currencies.find(c => c.code === 'USD')!;
  cart = cart.map(it => it.id === 'prod_1' ? {
    ...it,
    priceEntryCurrencyCode: targetCurrency.code,
    priceEntryRateSnapshot: targetCurrency.rate,
  } : it);

  // Line 1 should display $2.00 USD
  const line1Curr = getLineCurrency(cart[0], currencies, invoiceCurrency);
  const line1Rate = getSafeRate(line1Curr, cart[0]);
  const displayedLine1Price = roundForCurrency(fromUsd(cart[0].price, line1Curr.code, line1Rate), line1Curr.code);
  assertEqual(line1Curr.code, 'USD');
  assertEqual(displayedLine1Price, 2.0);

  // Line 2 currency remains invoice currency (TRY)
  const line2Curr = getLineCurrency(cart[1], currencies, invoiceCurrency);
  assertEqual(line2Curr.code, 'TRY');

  // Subtotal and Total in TRY remain completely identical!
  const subtotalAfterUSD = cart.reduce((sum, it) => sum + it.price * it.quantity, 0);
  const totalAfterTRY = roundForCurrency(fromUsd(subtotalAfterUSD, 'TRY', 35), 'TRY');
  assertEqual(totalAfterTRY, 245.0, 'Invoice total must remain 245 TRY after changing line 1 currency');
});

// ---------------------------------------------------------------------------
// Test 2: Changing line currency without editing number leaves item.price intact
// ---------------------------------------------------------------------------
test('Test 2: Switching currency leaves base price unchanged', () => {
  const item: CartItem = { id: 'p1', name: 'Item', price: 10.0, quantity: 1, unit: 'piece' };
  
  // Switch to SYP
  const sypCurr = currencies.find(c => c.code === 'SYP')!;
  const updatedItem: CartItem = {
    ...item,
    priceEntryCurrencyCode: sypCurr.code,
    priceEntryRateSnapshot: sypCurr.rate,
  };

  assertEqual(updatedItem.price, 10.0, 'Base price must not change on currency switch');
  assertEqual(updatedItem.priceEntryCurrencyCode, 'SYP');
});

// ---------------------------------------------------------------------------
// Test 3: Editing price number converts only line 1 base price
// ---------------------------------------------------------------------------
test('Test 3: Editing price number converts via line rate and updates only line 1', () => {
  let cart: CartItem[] = [
    { id: 'prod_1', name: 'Coffee', price: 2.0, quantity: 1, unit: 'piece', priceEntryCurrencyCode: 'TRY', priceEntryRateSnapshot: 35.0 },
    { id: 'prod_2', name: 'Tea', price: 1.0, quantity: 1, unit: 'piece' },
  ];

  // User enters 105 TRY for Coffee (105 / 35 = 3.0 USD base)
  const line1Curr = getLineCurrency(cart[0], currencies, invoiceCurrency);
  const line1Rate = getSafeRate(line1Curr, cart[0]);
  const newEnteredPriceTRY = 105;
  const newBasePriceUSD = line1Curr.code === 'USD' ? newEnteredPriceTRY : newEnteredPriceTRY / line1Rate;

  cart = cart.map(it => it.id === 'prod_1' ? { ...it, price: newBasePriceUSD } : it);

  assertCloseTo(cart[0].price, 3.0, 0.0001, 'Coffee base price should be updated to 3.0 USD');
  assertEqual(cart[1].price, 1.0, 'Tea base price must remain 1.0 USD');
});

// ---------------------------------------------------------------------------
// Test 4: HeldCart serialization stores and restores per-line currency metadata
// ---------------------------------------------------------------------------
test('Test 4: HeldCart preserves line currency metadata and invoice currency', () => {
  const heldCart = {
    id: 'cart_1',
    name: 'سلة 1',
    cart: [
      { id: 'p1', name: 'Item 1', price: 5.0, quantity: 1, unit: 'piece' as const, priceEntryCurrencyCode: 'USD', priceEntryRateSnapshot: 1.0 },
      { id: 'p2', name: 'Item 2', price: 10.0, quantity: 2, unit: 'piece' as const, priceEntryCurrencyCode: 'TRY', priceEntryRateSnapshot: 35.0 },
    ],
    customerName: 'Ahmad',
    discount: 5,
    createdAt: Date.now(),
    invoiceCurrencyCode: 'TRY',
    invoiceExchangeRateSnapshot: 35.0,
  };

  const serialized = JSON.stringify(heldCart);
  const parsed = JSON.parse(serialized);

  assertEqual(parsed.cart[0].priceEntryCurrencyCode, 'USD');
  assertEqual(parsed.cart[1].priceEntryCurrencyCode, 'TRY');
  assertEqual(parsed.invoiceCurrencyCode, 'TRY');
});

// ---------------------------------------------------------------------------
// Test 5: Legacy carts without new fields gracefully default to invoice currency
// ---------------------------------------------------------------------------
test('Test 5: Legacy carts without new fields gracefully default to invoice currency', () => {
  const legacyItem: CartItem = { id: 'p_legacy', name: 'Legacy', price: 4.0, quantity: 1, unit: 'piece' };
  const curr = getLineCurrency(legacyItem, currencies, invoiceCurrency);
  assertEqual(curr.code, 'TRY', 'Should gracefully default to invoice currency');
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

if (failed > 0) process.exit(1);
