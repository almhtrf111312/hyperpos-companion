import { ARABIC_TO_ENGLISH_CURRENCY_SYMBOLS, toEnglishCurrencySymbol } from '../currency-symbols';

function assertEqual(actual: string, expected: string, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected "${expected}", got "${actual}"`);
  }
}

for (const [legacySymbol, currencyCode] of Object.entries(ARABIC_TO_ENGLISH_CURRENCY_SYMBOLS)) {
  assertEqual(
    toEnglishCurrencySymbol(legacySymbol, currencyCode),
    currencyCode,
    `${legacySymbol} should normalize for ${currencyCode}`
  );
  assertEqual(
    toEnglishCurrencySymbol(legacySymbol, 'USD'),
    legacySymbol,
    `${legacySymbol} should not normalize for a different currency`
  );
}

assertEqual(toEnglishCurrencySymbol('  ر.ق  ', 'QAR'), 'QAR', 'Whitespace should be ignored');
assertEqual(toEnglishCurrencySymbol('ر.ق\u200f', 'QAR'), 'QAR', 'Direction marks should be ignored');
assertEqual(toEnglishCurrencySymbol('MyCoin', 'QAR'), 'MyCoin', 'Custom symbols should be preserved');
assertEqual(toEnglishCurrencySymbol('د.ب', 'BHR'), 'BHD', 'Legacy BHR code should normalize to BHD');
assertEqual(toEnglishCurrencySymbol('€', 'EUR'), '€', 'International glyphs should be preserved');

console.log(`[PASS] ${Object.keys(ARABIC_TO_ENGLISH_CURRENCY_SYMBOLS).length} legacy currency symbols and preservation cases`);
