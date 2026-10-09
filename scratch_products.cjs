const fs = require('fs');

// 1. First, Products.tsx
let path = 'src/pages/Products.tsx';
let code = fs.readFileSync(path, 'utf8');

// Add import for useCurrency at the top
if (!code.includes('useCurrency')) {
  code = code.replace(/import \{ cn, toWesternNumerals, formatNumber \} from '@\/lib\/utils';/, 
    \`import { cn, toWesternNumerals, formatNumber } from '@/lib/utils';
import { useCurrency } from '@/hooks/use-currency';\`);
}

// Inject useCurrency inside Products component
if (!code.includes('const { currencyCode, currencySymbol, exchangeRate } = useCurrency();')) {
  code = code.replace(/export default function Products\(\) \{/, 
    \`export default function Products() {
  const { currencyCode, currencySymbol, exchangeRate } = useCurrency();
  const formatPrice = (usdPrice: number) => {
    if (!usdPrice) usdPrice = 0;
    if (currencyCode === 'USD') return \\\`$\\\${formatNumber(usdPrice, 2)}\\\`;
    const localVal = usdPrice * exchangeRate;
    const decimals = currencyCode === 'SYP' ? 0 : 2;
    return \\\`\\\${formatNumber(localVal, decimals)} \\\${currencySymbol} <span class="text-[0.8em] opacity-60 ml-1">($\\\${formatNumber(usdPrice, 2)})</span>\\\`;
  };
  
  const formatPriceRaw = (usdPrice: number) => {
    if (!usdPrice) usdPrice = 0;
    if (currencyCode === 'USD') return \\\`$\\\${formatNumber(usdPrice, 2)}\\\`;
    const localVal = usdPrice * exchangeRate;
    const decimals = currencyCode === 'SYP' ? 0 : 2;
    return \\\`\\\${formatNumber(localVal, decimals)} \\\${currencySymbol} ($\\\${formatNumber(usdPrice, 2)})\\\`;
  };
  \`);
}

// Replace occurrences of formatNumber(product.salePrice) etc.
// 1574: <span className="font-bold text-xs text-foreground">{formatNumber(product.salePrice)} $</span>
code = code.replace(/\{formatNumber\(product\.salePrice\)\} \$/g, 
  \`<span dangerouslySetInnerHTML={{__html: formatPrice(product.salePrice)}} />\`);

// 1578: <span className="text-xs text-foreground/80">{formatNumber(product.costPrice)} $</span>
code = code.replace(/\{formatNumber\(product\.costPrice\)\} \$/g, 
  \`<span dangerouslySetInnerHTML={{__html: formatPrice(product.costPrice)}} />\`);

// 1868: <span>${formatNumber(product.salePrice, 2)}</span>
code = code.replace(/<span>\$\{formatNumber\(product\.salePrice, 2\)\}<\/span>/g, 
  \`<span dangerouslySetInnerHTML={{__html: formatPrice(product.salePrice)}} />\`);

// 1871: {noInventory && product.wholesalePrice > 0 && <span>{t('products.wholesalePrice')}: ${formatNumber(product.wholesalePrice, 2)}</span>}
code = code.replace(/<span>\{t\('products\.wholesalePrice'\)\}: \$\{formatNumber\(product\.wholesalePrice, 2\)\}<\/span>/g, 
  \`<span>{t('products.wholesalePrice')}: <span dangerouslySetInnerHTML={{__html: formatPrice(product.wholesalePrice)}} /></span>\`);

// 1912: {!noInventory && <span className="text-foreground/80 font-medium">${formatNumber(product.costPrice, 2)}</span>}
code = code.replace(/<span className="text-foreground\/80 font-medium">\$\{formatNumber\(product\.costPrice, 2\)\}<\/span>/g, 
  \`<span className="text-foreground/80 font-medium" dangerouslySetInnerHTML={{__html: formatPrice(product.costPrice)}} />\`);

// 1913: <span className="font-semibold text-primary">${formatNumber(product.salePrice, 2)}</span>
code = code.replace(/<span className="font-semibold text-primary">\$\{formatNumber\(product\.salePrice, 2\)\}<\/span>/g, 
  \`<span className="font-semibold text-primary" dangerouslySetInnerHTML={{__html: formatPrice(product.salePrice)}} />\`);

// 1915: {noInventory && product.wholesalePrice > 0 && <span className="text-muted-foreground">{t('products.wholesalePrice')}: ${formatNumber(product.wholesalePrice, 2)}</span>}
code = code.replace(/<span className="text-muted-foreground">\{t\('products\.wholesalePrice'\)\}: \$\{formatNumber\(product\.wholesalePrice, 2\)\}<\/span>/g, 
  \`<span className="text-muted-foreground">{t('products.wholesalePrice')}: <span dangerouslySetInnerHTML={{__html: formatPrice(product.wholesalePrice)}} /></span>\`);

// 2050: <p className="font-bold text-base text-foreground">${formatNumber(product.costPrice, 2)}</p>
code = code.replace(/<p className="font-bold text-base text-foreground">\$\{formatNumber\(product\.costPrice, 2\)\}<\/p>/g, 
  \`<p className="font-bold text-base text-foreground" dangerouslySetInnerHTML={{__html: formatPrice(product.costPrice)}} />\`);

// 2058: <p className="font-bold text-base text-primary">${formatNumber(product.costPrice + (product.laborCost || 0), 2)}</p>
code = code.replace(/<p className="font-bold text-base text-primary">\$\{formatNumber\(product\.costPrice \+ \(product\.laborCost \|\| 0\), 2\)\}<\/p>/g, 
  \`<p className="font-bold text-base text-primary" dangerouslySetInnerHTML={{__html: formatPrice(product.costPrice + (product.laborCost || 0))}} />\`);

// 2065: <p className="font-bold text-base text-primary">${formatNumber(product.salePrice, 2)}</p>
code = code.replace(/<p className="font-bold text-base text-primary">\$\{formatNumber\(product\.salePrice, 2\)\}<\/p>/g, 
  \`<p className="font-bold text-base text-primary" dangerouslySetInnerHTML={{__html: formatPrice(product.salePrice)}} />\`);

// 2069: <p className="font-bold text-base text-foreground">${formatNumber(product.wholesalePrice || 0, 2)}</p>
code = code.replace(/<p className="font-bold text-base text-foreground">\$\{formatNumber\(product\.wholesalePrice \|\| 0, 2\)\}<\/p>/g, 
  \`<p className="font-bold text-base text-foreground" dangerouslySetInnerHTML={{__html: formatPrice(product.wholesalePrice || 0)}} />\`);

// 2219: <span className="text-sm text-foreground">${formatNumber(product.costPrice, 2)}</span>
code = code.replace(/<span className="text-sm text-foreground">\$\{formatNumber\(product\.costPrice, 2\)\}<\/span>/g, 
  \`<span className="text-sm text-foreground" dangerouslySetInnerHTML={{__html: formatPrice(product.costPrice)}} />\`);

// 2225: <span className="font-semibold text-primary text-sm">${formatNumber(product.costPrice + (product.laborCost || 0), 2)}</span>
code = code.replace(/<span className="font-semibold text-primary text-sm">\$\{formatNumber\(product\.costPrice \+ \(product\.laborCost \|\| 0\), 2\)\}<\/span>/g, 
  \`<span className="font-semibold text-primary text-sm" dangerouslySetInnerHTML={{__html: formatPrice(product.costPrice + (product.laborCost || 0))}} />\`);

// 2231: <span className="font-semibold text-foreground text-sm">${formatNumber(product.salePrice, 2)}</span>
code = code.replace(/<span className="font-semibold text-foreground text-sm">\$\{formatNumber\(product\.salePrice, 2\)\}<\/span>/g, 
  \`<span className="font-semibold text-foreground text-sm" dangerouslySetInnerHTML={{__html: formatPrice(product.salePrice)}} />\`);

// 2236: <span className="text-foreground\/80 font-medium">${formatNumber(product.costPrice, 2)}</span>
code = code.replace(/<span className="text-foreground\/80 font-medium">\$\{formatNumber\(product\.costPrice, 2\)\}<\/span>/g, 
  \`<span className="text-foreground/80 font-medium" dangerouslySetInnerHTML={{__html: formatPrice(product.costPrice)}} />\`);

// 2240: <span className="font-semibold text-foreground">${formatNumber(product.salePrice, 2)}</span>
code = code.replace(/<span className="font-semibold text-foreground">\$\{formatNumber\(product\.salePrice, 2\)\}<\/span>/g, 
  \`<span className="font-semibold text-foreground" dangerouslySetInnerHTML={{__html: formatPrice(product.salePrice)}} />\`);

// 2249: <span className="text-sm text-foreground\/90 font-medium">${formatNumber(product.wholesalePrice || 0, 2)}</span>
code = code.replace(/<span className="text-sm text-foreground\/90 font-medium">\$\{formatNumber\(product\.wholesalePrice \|\| 0, 2\)\}<\/span>/g, 
  \`<span className="text-sm text-foreground/90 font-medium" dangerouslySetInnerHTML={{__html: formatPrice(product.wholesalePrice || 0)}} />\`);


// Handle Print Dialog prices (2080, 2086) which are inside backticks
code = code.replace(/\$\{formatNumber\(product\.costPrice, 2\)\}/g, \`\${formatPriceRaw(product.costPrice)}\`);
code = code.replace(/\$\{formatNumber\(product\.salePrice, 2\)\}/g, \`\${formatPriceRaw(product.salePrice)}\`);

fs.writeFileSync(path, code);
console.log('Products.tsx updated!');
