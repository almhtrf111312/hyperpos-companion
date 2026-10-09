const fs = require('fs');

let path = 'src/pages/POS.tsx';

// Need to restore POS.tsx from git and re-apply cleanly!
require('child_process').execSync('git checkout src/pages/POS.tsx');

let code = fs.readFileSync(path, 'utf8');

const regexCurrencies = /const currencies: Currency\[\] = useMemo\(\(\) => \{[\s\S]*?\}, \[\]\);/;
const newCurrencies = `const [settingsRev, setSettingsRev] = useState(0);

  useEffect(() => {
    const handleSettings = () => setSettingsRev(r => r + 1);
    window.addEventListener(EVENTS.SETTINGS_UPDATED, handleSettings as EventListener);
    window.addEventListener('settings-updated', handleSettings as EventListener);
    return () => {
      window.removeEventListener(EVENTS.SETTINGS_UPDATED, handleSettings as EventListener);
      window.removeEventListener('settings-updated', handleSettings as EventListener);
    };
  }, []);

  const currencies: Currency[] = useMemo(() => {
    const _ = settingsRev;
    const rates = loadExchangeRates();
    const names = loadCurrencyNames();
    return [
      { code: 'USD', symbol: '$$', name: t('currency.usd') || 'دولار', rate: 1 },
      { code: 'TRY', symbol: '₺', name: names.TRY || 'ليرة تركية', rate: rates.TRY },
      { code: 'SYP', symbol: 'ل.س', name: names.SYP || 'ليرة سورية', rate: rates.SYP },
    ];
  }, [settingsRev, t]);`;

code = code.replace(regexCurrencies, newCurrencies);

const regexSelected = /const \[selectedCurrency, setSelectedCurrency\] = useState<Currency>\(\(\) => currencies\[0\]\);/;
const newSelected = `const [selectedCurrency, setSelectedCurrency] = useState<Currency>(() => {
    const code = loadDefaultCurrencyCode();
    return currencies.find(c => c.code === code) || currencies[0];
  });

  useEffect(() => {
    const code = loadDefaultCurrencyCode();
    const newCurr = currencies.find(c => c.code === code) || currencies[0];
    setSelectedCurrency(prev => prev.code !== newCurr.code || prev.rate !== newCurr.rate ? newCurr : prev);
  }, [currencies]);`;

code = code.replace(regexSelected, newSelected);
fs.writeFileSync(path, code);
console.log('POS.tsx fixed and updated!');
