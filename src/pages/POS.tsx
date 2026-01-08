import { useState } from 'react';
import { 
  Search, 
  Barcode, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart,
  CreditCard,
  Banknote,
  Percent,
  Printer,
  Send,
  User,
  Package
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
  image?: string;
}

const mockProducts: Product[] = [
  { id: '1', name: 'iPhone 15 Pro Max', price: 1300, quantity: 15, category: 'هواتف' },
  { id: '2', name: 'Samsung Galaxy S24', price: 1000, quantity: 20, category: 'هواتف' },
  { id: '3', name: 'AirPods Pro 2', price: 250, quantity: 35, category: 'سماعات' },
  { id: '4', name: 'شاشة iPhone 13', price: 150, quantity: 50, category: 'قطع غيار' },
  { id: '5', name: 'سلك شحن Type-C', price: 15, quantity: 200, category: 'أكسسوارات' },
  { id: '6', name: 'حافظة iPhone 15', price: 25, quantity: 100, category: 'أكسسوارات' },
  { id: '7', name: 'شاحن سريع 65W', price: 45, quantity: 75, category: 'شواحن' },
  { id: '8', name: 'باور بانك 20000mAh', price: 55, quantity: 40, category: 'أكسسوارات' },
  { id: '9', name: 'Samsung Galaxy Tab S9', price: 850, quantity: 10, category: 'أجهزة لوحية' },
  { id: '10', name: 'Apple Watch Series 9', price: 450, quantity: 25, category: 'ساعات' },
  { id: '11', name: 'زجاج حماية iPhone', price: 10, quantity: 150, category: 'أكسسوارات' },
  { id: '12', name: 'سماعة بلوتوث JBL', price: 120, quantity: 30, category: 'سماعات' },
];

const categories = ['الكل', 'هواتف', 'أكسسوارات', 'سماعات', 'شواحن', 'قطع غيار', 'أجهزة لوحية', 'ساعات'];

const currencies = [
  { code: 'USD', symbol: '$', name: 'دولار أمريكي', rate: 1 },
  { code: 'TRY', symbol: '₺', name: 'ليرة تركية', rate: 32 },
  { code: 'SYP', symbol: 'ل.س', name: 'ليرة سورية', rate: 14500 },
];

export default function POS() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [selectedCurrency, setSelectedCurrency] = useState(currencies[0]);
  const [customerName, setCustomerName] = useState('');

  const filteredProducts = mockProducts.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'الكل' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, change: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const newQuantity = item.quantity + change;
          if (newQuantity <= 0) return item;
          return { ...item, quantity: newQuantity };
        }
        return item;
      });
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = (subtotal * discount) / 100;
  const total = subtotal - discountAmount;
  const totalInCurrency = total * selectedCurrency.rate;

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setCustomerName('');
  };

  return (
    <div className="h-screen flex">
      {/* Products Section */}
      <div className="flex-1 flex flex-col bg-background">
        {/* Search and Categories */}
        <div className="p-4 border-b border-border space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="بحث عن منتج..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10 h-12 bg-muted border-0 text-lg"
              />
            </div>
            <Button variant="outline" size="lg" className="h-12 px-4">
              <Barcode className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
                  selectedCategory === category
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredProducts.map((product, index) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="pos-item text-right fade-in"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="w-full aspect-square rounded-lg bg-muted/50 flex items-center justify-center mb-3">
                  <Package className="w-12 h-12 text-muted-foreground/50" />
                </div>
                <h3 className="font-semibold text-foreground text-sm line-clamp-2 mb-1">
                  {product.name}
                </h3>
                <p className="text-primary font-bold">${product.price}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  المخزون: {product.quantity}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cart Section */}
      <div className="w-96 bg-card border-r border-border flex flex-col">
        {/* Cart Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-lg">سلة المشتريات</h2>
            </div>
            {cart.length > 0 && (
              <button 
                onClick={clearCart}
                className="text-sm text-destructive hover:text-destructive/80"
              >
                إفراغ السلة
              </button>
            )}
          </div>

          {/* Customer Name */}
          <div className="mt-4 relative">
            <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="اسم العميل (اختياري)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="pr-10 bg-muted border-0"
            />
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShoppingCart className="w-16 h-16 mb-4 opacity-50" />
              <p>السلة فارغة</p>
              <p className="text-sm">اضغط على منتج لإضافته</p>
            </div>
          ) : (
            cart.map((item, index) => (
              <div 
                key={item.id}
                className="bg-muted rounded-xl p-3 slide-in-right"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-medium text-sm line-clamp-2">{item.name}</h4>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-8 h-8 rounded-lg bg-background flex items-center justify-center hover:bg-background/80"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-semibold">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-8 h-8 rounded-lg bg-background flex items-center justify-center hover:bg-background/80"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="font-bold text-primary">
                    ${(item.price * item.quantity).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Footer */}
        <div className="border-t border-border p-4 space-y-4">
          {/* Currency Selector */}
          <div className="flex gap-2">
            {currencies.map((currency) => (
              <button
                key={currency.code}
                onClick={() => setSelectedCurrency(currency)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                  selectedCurrency.code === currency.code
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {currency.symbol} {currency.code}
              </button>
            ))}
          </div>

          {/* Discount */}
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4 text-muted-foreground" />
            <Input
              type="number"
              placeholder="خصم %"
              value={discount || ''}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="bg-muted border-0"
              min="0"
              max="100"
            />
          </div>

          {/* Summary */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">المجموع الفرعي</span>
              <span>${subtotal.toLocaleString()}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-success">
                <span>الخصم ({discount}%)</span>
                <span>-${discountAmount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
              <span>الإجمالي</span>
              <span className="text-primary">
                {selectedCurrency.symbol}{totalInCurrency.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Payment Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              className="h-14 bg-success hover:bg-success/90"
              disabled={cart.length === 0}
            >
              <Banknote className="w-5 h-5 ml-2" />
              نقدي
            </Button>
            <Button
              variant="outline"
              className="h-14 border-warning text-warning hover:bg-warning hover:text-warning-foreground"
              disabled={cart.length === 0}
            >
              <CreditCard className="w-5 h-5 ml-2" />
              دين
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" disabled={cart.length === 0}>
              <Printer className="w-4 h-4 ml-2" />
              طباعة
            </Button>
            <Button variant="outline" className="flex-1" disabled={cart.length === 0}>
              <Send className="w-4 h-4 ml-2" />
              واتساب
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
