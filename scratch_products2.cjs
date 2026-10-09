const fs = require('fs');

let path = 'src/pages/Products.tsx';
let code = fs.readFileSync(path, 'utf8');

if (!code.includes('useCurrency')) {
  code = code.replace(/import \{ cn, toWesternNumerals, formatNumber \} from '@\/lib\/utils';/, 
    "import { cn, toWesternNumerals, formatNumber } from '@/lib/utils';\nimport { useCurrency } from '@/hooks/use-currency';");
}

if (!code.includes('const { currencyCode, currencySymbol, exchangeRate } = useCurrency();')) {
  code = code.replace(/export default function Products\(\) \{/, 
    "export default function Products() {\n" +
    "  const { currencyCode, currencySymbol, exchangeRate } = useCurrency();\n" +
    "  const formatPrice = (usdPrice: number) => {\n" +
    "    if (!usdPrice) usdPrice = 0;\n" +
    "    if (currencyCode === 'USD') return `$${formatNumber(usdPrice, 2)}`;\n" +
    "    const localVal = usdPrice * exchangeRate;\n" +
    "    const decimals = currencyCode === 'SYP' ? 0 : 2;\n" +
    "    return `${formatNumber(localVal, decimals)} ${currencySymbol} <span class=\"text-[0.8em] opacity-60 ml-1\">($${formatNumber(usdPrice, 2)})</span>`;\n" +
    "  };\n" +
    "  \n" +
    "  const formatPriceRaw = (usdPrice: number) => {\n" +
    "    if (!usdPrice) usdPrice = 0;\n" +
    "    if (currencyCode === 'USD') return `$${formatNumber(usdPrice, 2)}`;\n" +
    "    const localVal = usdPrice * exchangeRate;\n" +
    "    const decimals = currencyCode === 'SYP' ? 0 : 2;\n" +
    "    return `${formatNumber(localVal, decimals)} ${currencySymbol} ($${formatNumber(usdPrice, 2)})`;\n" +
    "  };\n"
  );
}

code = code.replace(/\{formatNumber\(product\.salePrice\)\} \$/g, 
  `<span dangerouslySetInnerHTML={{__html: formatPrice(product.salePrice)}} />`);

code = code.replace(/\{formatNumber\(product\.costPrice\)\} \$/g, 
  `<span dangerouslySetInnerHTML={{__html: formatPrice(product.costPrice)}} />`);

code = code.replace(/<span>\$\{formatNumber\(product\.salePrice, 2\)\}<\/span>/g, 
  `<span dangerouslySetInnerHTML={{__html: formatPrice(product.salePrice)}} />`);

code = code.replace(/<span>\{t\('products\.wholesalePrice'\)\}: \$\{formatNumber\(product\.wholesalePrice, 2\)\}<\/span>/g, 
  `<span>{t('products.wholesalePrice')}: <span dangerouslySetInnerHTML={{__html: formatPrice(product.wholesalePrice)}} /></span>`);

code = code.replace(/<span className="text-foreground\/80 font-medium">\$\{formatNumber\(product\.costPrice, 2\)\}<\/span>/g, 
  `<span className="text-foreground/80 font-medium" dangerouslySetInnerHTML={{__html: formatPrice(product.costPrice)}} />`);

code = code.replace(/<span className="font-semibold text-primary">\$\{formatNumber\(product\.salePrice, 2\)\}<\/span>/g, 
  `<span className="font-semibold text-primary" dangerouslySetInnerHTML={{__html: formatPrice(product.salePrice)}} />`);

code = code.replace(/<span className="text-muted-foreground">\{t\('products\.wholesalePrice'\)\}: \$\{formatNumber\(product\.wholesalePrice, 2\)\}<\/span>/g, 
  `<span className="text-muted-foreground">{t('products.wholesalePrice')}: <span dangerouslySetInnerHTML={{__html: formatPrice(product.wholesalePrice)}} /></span>`);

code = code.replace(/<p className="font-bold text-base text-foreground">\$\{formatNumber\(product\.costPrice, 2\)\}<\/p>/g, 
  `<p className="font-bold text-base text-foreground" dangerouslySetInnerHTML={{__html: formatPrice(product.costPrice)}} />`);

code = code.replace(/<p className="font-bold text-base text-primary">\$\{formatNumber\(product\.costPrice \+ \(product\.laborCost \|\| 0\), 2\)\}<\/p>/g, 
  `<p className="font-bold text-base text-primary" dangerouslySetInnerHTML={{__html: formatPrice(product.costPrice + (product.laborCost || 0))}} />`);

code = code.replace(/<p className="font-bold text-base text-primary">\$\{formatNumber\(product\.salePrice, 2\)\}<\/p>/g, 
  `<p className="font-bold text-base text-primary" dangerouslySetInnerHTML={{__html: formatPrice(product.salePrice)}} />`);

code = code.replace(/<p className="font-bold text-base text-foreground">\$\{formatNumber\(product\.wholesalePrice \|\| 0, 2\)\}<\/p>/g, 
  `<p className="font-bold text-base text-foreground" dangerouslySetInnerHTML={{__html: formatPrice(product.wholesalePrice || 0)}} />`);

code = code.replace(/<span className="text-sm text-foreground">\$\{formatNumber\(product\.costPrice, 2\)\}<\/span>/g, 
  `<span className="text-sm text-foreground" dangerouslySetInnerHTML={{__html: formatPrice(product.costPrice)}} />`);

code = code.replace(/<span className="font-semibold text-primary text-sm">\$\{formatNumber\(product\.costPrice \+ \(product\.laborCost \|\| 0\), 2\)\}<\/span>/g, 
  `<span className="font-semibold text-primary text-sm" dangerouslySetInnerHTML={{__html: formatPrice(product.costPrice + (product.laborCost || 0))}} />`);

code = code.replace(/<span className="font-semibold text-foreground text-sm">\$\{formatNumber\(product\.salePrice, 2\)\}<\/span>/g, 
  `<span className="font-semibold text-foreground text-sm" dangerouslySetInnerHTML={{__html: formatPrice(product.salePrice)}} />`);

code = code.replace(/<span className="text-foreground\/80 font-medium">\$\{formatNumber\(product\.costPrice, 2\)\}<\/span>/g, 
  `<span className="text-foreground/80 font-medium" dangerouslySetInnerHTML={{__html: formatPrice(product.costPrice)}} />`);

code = code.replace(/<span className="font-semibold text-foreground">\$\{formatNumber\(product\.salePrice, 2\)\}<\/span>/g, 
  `<span className="font-semibold text-foreground" dangerouslySetInnerHTML={{__html: formatPrice(product.salePrice)}} />`);

code = code.replace(/<span className="text-sm text-foreground\/90 font-medium">\$\{formatNumber\(product\.wholesalePrice \|\| 0, 2\)\}<\/span>/g, 
  `<span className="text-sm text-foreground/90 font-medium" dangerouslySetInnerHTML={{__html: formatPrice(product.wholesalePrice || 0)}} />`);

// For the raw formatted ones inside print templates
code = code.replace(/\$\{formatNumber\(product\.costPrice, 2\)\}/g, `\${formatPriceRaw(product.costPrice)}`);
code = code.replace(/\$\{formatNumber\(product\.salePrice, 2\)\}/g, `\${formatPriceRaw(product.salePrice)}`);

fs.writeFileSync(path, code);
console.log('Products.tsx updated!');
