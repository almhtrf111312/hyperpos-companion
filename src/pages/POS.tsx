import { useState, useEffect, useMemo } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { POSHeader } from '@/components/pos/POSHeader';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { CartPanel } from '@/components/pos/CartPanel';
import { MaintenancePanel } from '@/components/pos/MaintenancePanel';
import { ScannedProductDialog } from '@/components/pos/ScannedProductDialog';
import { Sidebar } from '@/components/layout/Sidebar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingCart, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getProductsForPOS, POSProduct, getProductByBarcode } from '@/lib/products-store';
import { getCategoryNames } from '@/lib/categories-store';
import { toast } from 'sonner';

const SETTINGS_STORAGE_KEY = 'hyperpos_settings_v1';

const loadExchangeRates = () => {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { TRY: 32, SYP: 14500 };
    const parsed = JSON.parse(raw);
    const ex = parsed?.exchangeRates;
    const TRY = Number(ex?.TRY ?? 32);
    const SYP = Number(ex?.SYP ?? 14500);
    return {
      TRY: Number.isFinite(TRY) && TRY > 0 ? TRY : 32,
      SYP: Number.isFinite(SYP) && SYP > 0 ? SYP : 14500,
    };
  } catch {
    return { TRY: 32, SYP: 14500 };
  }
};

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

type Currency = { code: 'USD' | 'TRY' | 'SYP'; symbol: string; name: string; rate: number };

export default function POS() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<'products' | 'maintenance'>('products');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);

  // Scanned product dialog
  const [scannedProduct, setScannedProduct] = useState<POSProduct | null>(null);
  const [showScannedDialog, setShowScannedDialog] = useState(false);

  // Load products and categories from shared stores
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [categories, setCategories] = useState<string[]>(['الكل']);

  // Reload data when component mounts or when returning to this page
  useEffect(() => {
    const loadData = () => {
      setProducts(getProductsForPOS());
      setCategories(['الكل', ...getCategoryNames()]);
    };
    
    loadData();
    
    // Listen for storage changes (when products/categories are updated in other pages)
    const handleStorage = (e: StorageEvent) => {
      if (e.key?.includes('hyperpos')) {
        loadData();
      }
    };
    
    window.addEventListener('storage', handleStorage);
    
    // Also reload when window gains focus (user returns from another tab/page)
    const handleFocus = () => loadData();
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const currencies: Currency[] = useMemo(() => {
    const rates = loadExchangeRates();
    return [
      { code: 'USD', symbol: '$', name: 'دولار أمريكي', rate: 1 },
      { code: 'TRY', symbol: '₺', name: 'ليرة تركية', rate: rates.TRY },
      { code: 'SYP', symbol: 'ل.س', name: 'ليرة سورية', rate: rates.SYP },
    ];
  }, []);

  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(() => currencies[0]);
  const [customerName, setCustomerName] = useState('');

  const addToCart = (product: POSProduct) => {
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
    toast.success(`تمت إضافة "${product.name}" إلى السلة`);
  };

  // Handle barcode scan - show product dialog instead of adding directly
  const handleBarcodeScan = (barcode: string) => {
    const product = getProductByBarcode(barcode);
    
    if (product) {
      setScannedProduct(product);
      setShowScannedDialog(true);
    } else {
      setSearchQuery(barcode);
      toast.info(`الباركود: ${barcode}`, { description: 'لم يتم العثور على منتج بهذا الباركود' });
    }
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

      {/* Mode Tabs */}
      <div className="flex-shrink-0 border-b border-border px-3 md:px-4 py-2">
        <Tabs value={activeMode} onValueChange={(v) => setActiveMode(v as 'products' | 'maintenance')}>
          <TabsList className="w-full max-w-xs">
            <TabsTrigger value="products" className="flex-1 gap-2">
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline">المنتجات</span>
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="flex-1 gap-2">
              <Wrench className="w-4 h-4" />
              <span className="hidden sm:inline">الصيانة</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {activeMode === 'products' ? (
          <>
            {/* Products Section */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <ProductGrid
                products={products}
                categories={categories}
                searchQuery={searchQuery}
                selectedCategory={selectedCategory}
                onSearchChange={setSearchQuery}
                onCategoryChange={setSelectedCategory}
                onProductClick={addToCart}
                onBarcodeScan={handleBarcodeScan}
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
          </>
        ) : (
          <>
            {/* Maintenance Mode - Full width on mobile, with panel on desktop */}
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center text-muted-foreground">
                <Wrench className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">أدخل بيانات خدمة الصيانة من اللوحة الجانبية</p>
              </div>
            </div>

            {/* Maintenance Panel - Desktop/Tablet */}
            <div className="w-72 md:w-80 lg:w-96 flex-shrink-0 hidden md:flex flex-col h-full overflow-hidden">
              <MaintenancePanel
                currencies={currencies}
                selectedCurrency={selectedCurrency}
                onCurrencyChange={setSelectedCurrency}
              />
            </div>
          </>
        )}
      </div>

      {/* Cart Drawer - Mobile (Products Mode) */}
      {activeMode === 'products' && (
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
      )}

      {/* Maintenance Panel - Mobile */}
      {activeMode === 'maintenance' && isMobile && (
        <Sheet open={cartOpen} onOpenChange={setCartOpen}>
          <SheetContent 
            side="bottom" 
            className="h-[85vh] p-0 rounded-t-2xl"
          >
            <MaintenancePanel
              currencies={currencies}
              selectedCurrency={selectedCurrency}
              onCurrencyChange={setSelectedCurrency}
              onClose={() => setCartOpen(false)}
              isMobile
            />
          </SheetContent>
        </Sheet>
      )}

      {/* Scanned Product Dialog */}
      <ScannedProductDialog
        isOpen={showScannedDialog}
        onClose={() => setShowScannedDialog(false)}
        product={scannedProduct}
        onAddToCart={addToCart}
      />
    </div>
  );
}
