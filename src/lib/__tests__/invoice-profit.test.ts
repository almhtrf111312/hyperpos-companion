import type { Invoice } from '../cloud/invoices-cloud';
import { calculateInvoiceProfitMetrics } from '../invoice-profit';

const invoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: 'INV-TEST',
  type: 'sale',
  customerName: 'Test customer',
  items: [],
  subtotal: 100,
  discount: 0,
  total: 100,
  totalInCurrency: 100,
  currency: 'USD',
  currencySymbol: '$',
  paymentType: 'cash',
  status: 'paid',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

function assertEqual(actual: number, expected: number, message: string) {
  if (Math.abs(actual - expected) > 0.000001) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function test(name: string, run: () => void) {
  try {
    run();
    console.log(`[PASS] ${name}`);
  } catch (error) {
    console.error(`[FAIL] ${name}`, error);
    (globalThis as { process?: { exitCode?: number } }).process!.exitCode = 1;
  }
}

test('sales revenue excludes discounts and item costs are summed in USD', () => {
  const result = calculateInvoiceProfitMetrics(invoice({
    subtotal: 100,
    discount: 10,
    total: 95,
    taxAmount: 5,
    profit: 30,
    items: [
      { id: 'a', name: 'A', price: 30, quantity: 2, total: 60, costPrice: 20 },
      { id: 'b', name: 'B', price: 20, quantity: 2, total: 40, costPrice: 10 },
    ],
  }), 30);

  assertEqual(result.netRevenueUsd, 90, 'Net sales');
  assertEqual(result.totalCostUsd, 60, 'Cost of goods');
  assertEqual(result.profitMarginPercent, 100 / 3, 'Profit margin');
});

test('partial debt collection divides invoice profit between collected and pending', () => {
  const result = calculateInvoiceProfitMetrics(invoice({
    subtotal: 100,
    total: 100,
    paymentType: 'debt',
    status: 'pending',
    debtPaid: 40,
    debtRemaining: 60,
  }), 25);

  assertEqual(result.collectionRatio, 0.4, 'Collection ratio');
  assertEqual(result.collectedProfitUsd, 10, 'Collected profit');
  assertEqual(result.pendingProfitUsd, 15, 'Pending profit');
});

test('maintenance invoices use the saved parts cost', () => {
  const result = calculateInvoiceProfitMetrics(invoice({
    type: 'maintenance',
    subtotal: 80,
    total: 80,
    partsCost: 30,
    paymentType: 'cash',
  }), 50);

  assertEqual(result.netRevenueUsd, 80, 'Maintenance revenue');
  assertEqual(result.totalCostUsd, 30, 'Parts cost');
  assertEqual(result.collectionRatio, 1, 'Cash collection ratio');
});

test('missing item costs fall back to net revenue minus saved profit', () => {
  const result = calculateInvoiceProfitMetrics(invoice({
    subtotal: 70,
    discount: 10,
    total: 60,
    items: [{ id: 'a', name: 'A', price: 70, quantity: 1, total: 70 }],
  }), 20);

  assertEqual(result.totalCostUsd, 40, 'Fallback cost');
});

console.log('Invoice profit tests completed');
