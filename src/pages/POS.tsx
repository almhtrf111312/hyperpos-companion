import { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { POSHeader } from '@/components/pos/POSHeader';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { CartPanel } from '@/components/pos/CartPanel';
import { Sidebar } from '@/components/layout/Sidebar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
  image?: string;
  barcode?: string;
}

const mockProducts: Product[] = [
  { id: '1', name: 'iPhone 15 Pro Max', price: 1300, quantity: 15, category: 'هواتف', barcode: '123456789001' },
  { id: '2', name: 'Samsung Galaxy S24', price: 1000, quantity: 20, category: 'هواتف', barcode: '123456789002' },
  { id: '3', name: 'AirPods Pro 2', price: 250, quantity: 35, category: 'سماعات', barcode: '123456789003' },
  { id: '4', name: 'شاشة iPhone 13', price: 150, quantity: 50, category: 'قطع غيار', barcode: '123456789004' },
  { id: '5', name: 'سلك شحن Type-C', price: 15, quantity: 200, category: 'أكسسوارات', barcode: '123456789005' },
  { id: '6', name: 'حافظة iPhone 15', price: 25, quantity: 100, category: 'أكسسوارات', barcode: '123456789006' },
  { id: '7', name: 'شاحن سريع 65W', price: 45, quantity: 75, category: 'شواحن', barcode: '123456789007' },
  { id: '8', name: 'باور بانك 20000mAh', price: 55, quantity: 40, category: 'أكسسوارات', barcode: '123456789008' },
  { id: '9', name: 'Samsung Galaxy Tab S9', price: 850, quantity: 10, category: 'أجهزة لوحية', barcode: '123456789009' },
  { id: '10', name: 'Apple Watch Series 9', price: 450, quantity: 25, category: 'ساعات', barcode: '123456789010' },
  { id: '11', name: 'زجاج حماية iPhone', price: 10, quantity: 150, category: 'أكسسوارات', barcode: '123456789011' },
  { id: '12', name: 'سماعة بلوتوث JBL', price: 120, quantity: 30, category: 'سماعات', barcode: '123456789012' },
];

const categories = ['الكل', 'هواتف', 'أكسسوارات', 'سماعات', 'شواحن', 'قطع غيار', 'أجهزة لوحية', 'ساعات'];

const currencies = [
  { code: 'USD', symbol: '$', name: 'دولار أمريكي', rate: 1 },
  { code: 'TRY', symbol: '₺', name: 'ليرة تركية', rate: 32 },
  { code: 'SYP', symbol: 'ل.س', name: 'ليرة سورية', rate: 14500 },
];

export default function POS() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [selectedCurrency, setSelectedCurrency] = useState(currencies[0]);
  const [customerName, setCustomerName] = useState('');

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

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setCustomerName('');
  };

  // Determine if we're on tablet (md breakpoint)
  const [isTablet, setIsTablet] = useState(false);
  
  useEffect(() => {
    const checkDevice = () => {
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    };
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Sidebar for navigation */}
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      {/* Header - Always visible */}
      <div className="flex-shrink-0">
        <POSHeader
          cartItemsCount={cart.length}
          onMenuClick={() => setSidebarOpen(true)}
          onCartClick={() => setCartOpen(true)}
          showCartButton={isMobile}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Products Section */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <ProductGrid
            products={mockProducts}
            categories={categories}
            searchQuery={searchQuery}
            selectedCategory={selectedCategory}
            onSearchChange={setSearchQuery}
            onCategoryChange={setSelectedCategory}
            onProductClick={addToCart}
          />
        </div>

        {/* Cart Section - Desktop/Tablet */}
        <div className="w-72 md:w-80 lg:w-96 flex-shrink-0 hidden md:flex flex-col h-full overflow-hidden">
          <CartPanel
            cart={cart}
            currencies={currencies}
            selectedCurrency={selectedCurrency}
            discount={discount}
            customerName={customerName}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeFromCart}
            onClearCart={clearCart}
            onCurrencyChange={setSelectedCurrency}
            onDiscountChange={setDiscount}
            onCustomerNameChange={setCustomerName}
          />
        </div>
      </div>

      {/* Cart Drawer - Mobile */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent 
          side="bottom" 
          className="h-[85vh] p-0 rounded-t-2xl"
        >
          <CartPanel
            cart={cart}
            currencies={currencies}
            selectedCurrency={selectedCurrency}
            discount={discount}
            customerName={customerName}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeFromCart}
            onClearCart={clearCart}
            onCurrencyChange={setSelectedCurrency}
            onDiscountChange={setDiscount}
            onCustomerNameChange={setCustomerName}
            onClose={() => setCartOpen(false)}
            isMobile
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
