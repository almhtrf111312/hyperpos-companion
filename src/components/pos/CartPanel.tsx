import { useState } from 'react';
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  User, 
  Percent,
  Banknote,
  CreditCard,
  Printer,
  Send,
  X,
  UserPlus,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from 'sonner';
import { addInvoice } from '@/lib/invoices-store';
import { findOrCreateCustomer, updateCustomerStats } from '@/lib/customers-store';
import { addDebtFromInvoice } from '@/lib/debts-store';
import { loadProducts, deductStockBatch } from '@/lib/products-store';
import { distributeDetailedProfit } from '@/lib/partners-store';
import { addActivityLog } from '@/lib/activity-log';
import { useAuth } from '@/hooks/use-auth';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Currency {
  code: 'USD' | 'TRY' | 'SYP';
  symbol: string;
  name: string;
  rate: number;
}

interface CartPanelProps {
  cart: CartItem[];
  currencies: Currency[];
  selectedCurrency: Currency;
  discount: number;
  customerName: string;
  onUpdateQuantity: (id: string, change: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onCurrencyChange: (currency: Currency) => void;
  onDiscountChange: (discount: number) => void;
  onCustomerNameChange: (name: string) => void;
  onClose?: () => void;
  isMobile?: boolean;
}

export function CartPanel({
  cart,
  currencies,
  selectedCurrency,
  discount,
  customerName,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onCurrencyChange,
  onDiscountChange,
  onCustomerNameChange,
  onClose,
  isMobile = false,
}: CartPanelProps) {
  const { user, profile } = useAuth();
  const [showCashDialog, setShowCashDialog] = useState(false);
  const [showDebtDialog, setShowDebtDialog] = useState(false);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = (subtotal * discount) / 100;
  const total = subtotal - discountAmount;
  const totalInCurrency = total * selectedCurrency.rate;

  const handleCashSale = () => {
    if (cart.length === 0) return;
    setShowCashDialog(true);
  };

  const handleDebtSale = () => {
    if (cart.length === 0) return;
    if (!customerName) {
      toast.error('يرجى إدخال اسم العميل أولاً');
      return;
    }
    setShowDebtDialog(true);
  };

  const confirmCashSale = () => {
    // Find or create customer
    const customer = customerName ? findOrCreateCustomer(customerName) : null;
    
    // Calculate profit by category for accurate partner distribution
    const products = loadProducts();
    const profitsByCategory: Record<string, number> = {};
    let totalProfit = 0;
    
    cart.forEach((item) => {
      const product = products.find(p => p.id === item.id);
      if (product) {
        const itemProfit = (item.price - product.costPrice) * item.quantity;
        const category = product.category || 'عام';
        profitsByCategory[category] = (profitsByCategory[category] || 0) + itemProfit;
        totalProfit += itemProfit;
      }
    });
    
    // Apply discount to profit
    const discountedProfit = totalProfit * (1 - discount / 100);
    const discountMultiplier = 1 - discount / 100;
    
    // Create invoice
    const invoice = addInvoice({
      type: 'sale',
      customerName: customerName || 'عميل نقدي',
      items: cart.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        total: item.price * item.quantity,
      })),
      subtotal,
      discount,
      total,
      totalInCurrency,
      currency: selectedCurrency.code,
      currencySymbol: selectedCurrency.symbol,
      paymentType: 'cash',
      status: 'paid',
      profit: discountedProfit,
    });
    
    // Distribute profit to partners by category - استدعاء واحد لتجنب Race Condition
    const categoryProfits = Object.entries(profitsByCategory)
      .filter(([_, profit]) => profit * discountMultiplier > 0)
      .map(([category, profit]) => ({
        category,
        profit: profit * discountMultiplier
      }));
    
    if (categoryProfits.length > 0) {
      distributeDetailedProfit(categoryProfits, invoice.id, customerName || 'عميل نقدي', false);
    }
    
    // Deduct stock from inventory
    deductStockBatch(cart.map(item => ({ productId: item.id, quantity: item.quantity })));
    
    // Update customer stats
    if (customer) {
      updateCustomerStats(customer.id, total, false);
    }
    
    // Log activity
    if (user) {
      addActivityLog(
        'sale',
        user.id,
        profile?.full_name || user.email || 'مستخدم',
        `عملية بيع نقدي بقيمة $${total.toLocaleString()}`,
        { invoiceId: invoice.id, total, itemsCount: cart.length, customerName: customerName || 'عميل نقدي' }
      );
    }
    
    toast.success(`تم إنشاء الفاتورة ${invoice.id} بنجاح`);
    setShowCashDialog(false);
    onClearCart();
  };

  const confirmDebtSale = () => {
    // Find or create customer
    const customer = findOrCreateCustomer(customerName);
    
    // Calculate profit by category for accurate partner distribution
    const products = loadProducts();
    const profitsByCategory: Record<string, number> = {};
    let totalProfit = 0;
    
    cart.forEach((item) => {
      const product = products.find(p => p.id === item.id);
      if (product) {
        const itemProfit = (item.price - product.costPrice) * item.quantity;
        const category = product.category || 'عام';
        profitsByCategory[category] = (profitsByCategory[category] || 0) + itemProfit;
        totalProfit += itemProfit;
      }
    });
    
    // Apply discount to profit
    const discountedProfit = totalProfit * (1 - discount / 100);
    const discountMultiplier = 1 - discount / 100;
    
    // Create invoice
    const invoice = addInvoice({
      type: 'sale',
      customerName,
      items: cart.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        total: item.price * item.quantity,
      })),
      subtotal,
      discount,
      total,
      totalInCurrency,
      currency: selectedCurrency.code,
      currencySymbol: selectedCurrency.symbol,
      paymentType: 'debt',
      status: 'pending',
      profit: discountedProfit,
    });
    
    // Create debt record
    addDebtFromInvoice(invoice.id, customerName, '', total);
    
    // Distribute profit to partners by category (as pending) - استدعاء واحد لتجنب Race Condition
    const categoryProfits = Object.entries(profitsByCategory)
      .filter(([_, profit]) => profit * discountMultiplier > 0)
      .map(([category, profit]) => ({
        category,
        profit: profit * discountMultiplier
      }));
    
    if (categoryProfits.length > 0) {
      distributeDetailedProfit(categoryProfits, invoice.id, customerName, true);
    }
    
    // Deduct stock from inventory
    deductStockBatch(cart.map(item => ({ productId: item.id, quantity: item.quantity })));
    
    // Update customer stats
    updateCustomerStats(customer.id, total, true);
    
    // Log activity
    if (user) {
      addActivityLog(
        'sale',
        user.id,
        profile?.full_name || user.email || 'مستخدم',
        `عملية بيع بالدين بقيمة $${total.toLocaleString()} للعميل ${customerName}`,
        { invoiceId: invoice.id, total, itemsCount: cart.length, customerName, paymentType: 'debt' }
      );
      
      addActivityLog(
        'debt_created',
        user.id,
        profile?.full_name || user.email || 'مستخدم',
        `تم إنشاء دين جديد للعميل ${customerName} بقيمة $${total.toLocaleString()}`,
        { invoiceId: invoice.id, amount: total, customerName }
      );
    }
    
    toast.success(`تم إنشاء فاتورة الدين ${invoice.id} بنجاح`);
    setShowDebtDialog(false);
    onClearCart();
  };

  const handleAddCustomer = () => {
    if (!newCustomer.name || !newCustomer.phone) {
      toast.error('يرجى ملء الحقول المطلوبة');
      return;
    }
    // Add customer to store
    findOrCreateCustomer(newCustomer.name, newCustomer.phone);
    onCustomerNameChange(newCustomer.name);
    toast.success('تم إضافة العميل بنجاح');
    setShowCustomerDialog(false);
    setNewCustomer({ name: '', phone: '', email: '' });
  };

  const handlePrint = () => {
    if (cart.length === 0) return;
    toast.info('جاري تجهيز الطباعة...');
    setTimeout(() => {
      toast.success('تم إرسال الفاتورة للطباعة');
    }, 1000);
  };

  const handleWhatsApp = () => {
    if (cart.length === 0) return;
    toast.info('جاري فتح واتساب...');
    const message = `فاتورة من HyperPOS\n\nالمجموع: ${selectedCurrency.symbol}${totalInCurrency.toLocaleString()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <>
      <div className={cn(
        "bg-card flex flex-col h-full",
        isMobile ? "rounded-t-2xl" : "border-r border-border"
      )}>
        {/* Cart Header */}
        <div className="p-3 md:p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              <h2 className="font-bold text-base md:text-lg">سلة المشتريات</h2>
              {cart.length > 0 && (
                <span className="bg-primary/20 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                  {cart.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {cart.length > 0 && (
                <button 
                  onClick={onClearCart}
                  className="text-xs md:text-sm text-destructive hover:text-destructive/80"
                >
                  إفراغ
                </button>
              )}
              {isMobile && onClose && (
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Customer Name */}
          <div className="mt-3 flex gap-2">
            <div className="flex-1 relative">
              <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="اسم العميل"
                value={customerName}
                onChange={(e) => onCustomerNameChange(e.target.value)}
                className="pr-9 bg-muted border-0 h-9 md:h-10 text-sm"
              />
            </div>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-9 w-9 md:h-10 md:w-10 flex-shrink-0"
              onClick={() => setShowCustomerDialog(true)}
            >
              <UserPlus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2 md:space-y-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
              <ShoppingCart className="w-12 h-12 md:w-16 md:h-16 mb-3 md:mb-4 opacity-50" />
              <p className="text-sm md:text-base">السلة فارغة</p>
              <p className="text-xs md:text-sm">اضغط على منتج لإضافته</p>
            </div>
          ) : (
            cart.map((item, index) => (
              <div 
                key={item.id}
                className="bg-muted rounded-lg md:rounded-xl p-2.5 md:p-3 slide-in-right"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-medium text-xs md:text-sm line-clamp-2">{item.name}</h4>
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <button
                      onClick={() => onUpdateQuantity(item.id, -1)}
                      className="w-7 h-7 md:w-8 md:h-8 rounded-md md:rounded-lg bg-background flex items-center justify-center hover:bg-background/80"
                    >
                      <Minus className="w-3 h-3 md:w-4 md:h-4" />
                    </button>
                    <span className="w-6 md:w-8 text-center font-semibold text-sm">{item.quantity}</span>
                    <button
                      onClick={() => onUpdateQuantity(item.id, 1)}
                      className="w-7 h-7 md:w-8 md:h-8 rounded-md md:rounded-lg bg-background flex items-center justify-center hover:bg-background/80"
                    >
                      <Plus className="w-3 h-3 md:w-4 md:h-4" />
                    </button>
                  </div>
                  <p className="font-bold text-primary text-sm md:text-base">
                    ${(item.price * item.quantity).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Footer */}
        <div className="border-t border-border p-3 md:p-4 space-y-3 md:space-y-4">
          {/* Currency Selector */}
          <div className="flex gap-1.5 md:gap-2">
            {currencies.map((currency) => (
              <button
                key={currency.code}
                onClick={() => onCurrencyChange(currency)}
                className={cn(
                  "flex-1 py-1.5 md:py-2 rounded-md md:rounded-lg text-xs md:text-sm font-medium transition-all",
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
            <Percent className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Input
              type="number"
              placeholder="خصم %"
              value={discount || ''}
              onChange={(e) => onDiscountChange(Number(e.target.value))}
              className="bg-muted border-0 h-9 text-sm"
              min="0"
              max="100"
            />
          </div>

          {/* Summary */}
          <div className="space-y-1.5 md:space-y-2 text-xs md:text-sm">
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
            <div className="flex justify-between text-base md:text-lg font-bold pt-2 border-t border-border">
              <span>الإجمالي</span>
              <span className="text-primary">
                {selectedCurrency.symbol}{totalInCurrency.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Payment Buttons */}
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            <Button
              className="h-11 md:h-14 bg-success hover:bg-success/90 text-sm md:text-base"
              disabled={cart.length === 0}
              onClick={handleCashSale}
            >
              <Banknote className="w-4 h-4 md:w-5 md:h-5 ml-1.5 md:ml-2" />
              نقدي
            </Button>
            <Button
              variant="outline"
              className="h-11 md:h-14 border-warning text-warning hover:bg-warning hover:text-warning-foreground text-sm md:text-base"
              disabled={cart.length === 0}
              onClick={handleDebtSale}
            >
              <CreditCard className="w-4 h-4 md:w-5 md:h-5 ml-1.5 md:ml-2" />
              دين
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1 h-9 md:h-10 text-xs md:text-sm" 
              disabled={cart.length === 0}
              onClick={handlePrint}
            >
              <Printer className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1.5 md:ml-2" />
              طباعة
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 h-9 md:h-10 text-xs md:text-sm" 
              disabled={cart.length === 0}
              onClick={handleWhatsApp}
            >
              <Send className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1.5 md:ml-2" />
              واتساب
            </Button>
          </div>
        </div>
      </div>

      {/* Cash Sale Dialog */}
      <Dialog open={showCashDialog} onOpenChange={setShowCashDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-success" />
              تأكيد البيع النقدي
            </DialogTitle>
            <DialogDescription>
              هل تريد تأكيد الفاتورة النقدية؟
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>عدد المنتجات:</span>
                <span className="font-semibold">{cart.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>العميل:</span>
                <span className="font-semibold">{customerName || 'بدون اسم'}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-border pt-2 mt-2">
                <span>الإجمالي:</span>
                <span className="text-primary">{selectedCurrency.symbol}{totalInCurrency.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowCashDialog(false)}>
                إلغاء
              </Button>
              <Button className="flex-1 bg-success hover:bg-success/90" onClick={confirmCashSale}>
                <Check className="w-4 h-4 ml-2" />
                تأكيد
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Debt Sale Dialog */}
      <Dialog open={showDebtDialog} onOpenChange={setShowDebtDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-warning" />
              تأكيد البيع بالدين
            </DialogTitle>
            <DialogDescription>
              سيتم إضافة المبلغ كدين على العميل
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>العميل:</span>
                <span className="font-semibold">{customerName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>عدد المنتجات:</span>
                <span className="font-semibold">{cart.length}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-border pt-2 mt-2 text-warning">
                <span>مبلغ الدين:</span>
                <span>{selectedCurrency.symbol}{totalInCurrency.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowDebtDialog(false)}>
                إلغاء
              </Button>
              <Button className="flex-1 bg-warning hover:bg-warning/90 text-warning-foreground" onClick={confirmDebtSale}>
                <Check className="w-4 h-4 ml-2" />
                تأكيد الدين
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Customer Dialog */}
      <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              إضافة عميل جديد
            </DialogTitle>
            <DialogDescription>
              أدخل بيانات العميل الجديد
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">الاسم *</label>
                <Input
                  placeholder="اسم العميل"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">رقم الهاتف *</label>
                <Input
                  placeholder="+963 xxx xxx xxx"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">البريد الإلكتروني</label>
                <Input
                  placeholder="email@example.com"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowCustomerDialog(false)}>
                إلغاء
              </Button>
              <Button className="flex-1" onClick={handleAddCustomer}>
                <UserPlus className="w-4 h-4 ml-2" />
                إضافة العميل
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
