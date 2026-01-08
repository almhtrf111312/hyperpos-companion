import { useState } from 'react';
import { 
  Search, 
  Plus, 
  Filter, 
  Package,
  Edit,
  Trash2,
  MoreVertical,
  Barcode,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Product {
  id: string;
  name: string;
  barcode: string;
  category: string;
  costPrice: number;
  salePrice: number;
  quantity: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
}

const mockProducts: Product[] = [
  { id: '1', name: 'iPhone 15 Pro Max', barcode: '123456789001', category: 'هواتف', costPrice: 1100, salePrice: 1300, quantity: 15, status: 'in_stock' },
  { id: '2', name: 'Samsung Galaxy S24', barcode: '123456789002', category: 'هواتف', costPrice: 850, salePrice: 1000, quantity: 20, status: 'in_stock' },
  { id: '3', name: 'AirPods Pro 2', barcode: '123456789003', category: 'سماعات', costPrice: 180, salePrice: 250, quantity: 5, status: 'low_stock' },
  { id: '4', name: 'شاشة iPhone 13', barcode: '123456789004', category: 'قطع غيار', costPrice: 100, salePrice: 150, quantity: 0, status: 'out_of_stock' },
  { id: '5', name: 'سلك شحن Type-C', barcode: '123456789005', category: 'أكسسوارات', costPrice: 8, salePrice: 15, quantity: 200, status: 'in_stock' },
  { id: '6', name: 'حافظة iPhone 15', barcode: '123456789006', category: 'أكسسوارات', costPrice: 12, salePrice: 25, quantity: 100, status: 'in_stock' },
  { id: '7', name: 'شاحن سريع 65W', barcode: '123456789007', category: 'شواحن', costPrice: 30, salePrice: 45, quantity: 3, status: 'low_stock' },
  { id: '8', name: 'باور بانك 20000mAh', barcode: '123456789008', category: 'أكسسوارات', costPrice: 35, salePrice: 55, quantity: 40, status: 'in_stock' },
];

const statusConfig = {
  in_stock: { label: 'متوفر', color: 'badge-success', icon: CheckCircle },
  low_stock: { label: 'كمية منخفضة', color: 'badge-warning', icon: AlertTriangle },
  out_of_stock: { label: 'نفذ المخزون', color: 'badge-danger', icon: AlertTriangle },
};

export default function Products() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('الكل');

  const categories = ['الكل', ...new Set(mockProducts.map(p => p.category))];

  const filteredProducts = mockProducts.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.barcode.includes(searchQuery);
    const matchesCategory = selectedCategory === 'الكل' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const stats = {
    total: mockProducts.length,
    inStock: mockProducts.filter(p => p.status === 'in_stock').length,
    lowStock: mockProducts.filter(p => p.status === 'low_stock').length,
    outOfStock: mockProducts.filter(p => p.status === 'out_of_stock').length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">إدارة المنتجات</h1>
          <p className="text-muted-foreground mt-1">إدارة مخزون المنتجات والأسعار</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="w-5 h-5 ml-2" />
          إضافة منتج
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-sm text-muted-foreground">إجمالي المنتجات</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.inStock}</p>
              <p className="text-sm text-muted-foreground">متوفر</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.lowStock}</p>
              <p className="text-sm text-muted-foreground">كمية منخفضة</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.outOfStock}</p>
              <p className="text-sm text-muted-foreground">نفذ المخزون</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="بحث بالاسم أو الباركود..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10 bg-muted border-0"
          />
        </div>
        <div className="flex gap-2">
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

      {/* Products Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">المنتج</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">الباركود</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">التصنيف</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">سعر الشراء</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">سعر البيع</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">الربح</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">الكمية</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">الحالة</th>
                <th className="text-center py-4 px-6 text-sm font-medium text-muted-foreground">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product, index) => {
                const status = statusConfig[product.status];
                const profit = product.salePrice - product.costPrice;
                const profitPercentage = ((profit / product.costPrice) * 100).toFixed(0);
                
                return (
                  <tr 
                    key={product.id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors fade-in"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                          <Package className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <span className="font-medium text-foreground">{product.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <Barcode className="w-4 h-4 text-muted-foreground" />
                        <span className="font-mono text-sm text-muted-foreground">{product.barcode}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                        {product.category}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-muted-foreground">${product.costPrice}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-semibold text-foreground">${product.salePrice}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="font-semibold text-success">${profit}</span>
                        <span className="text-xs text-muted-foreground">{profitPercentage}%</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-semibold text-foreground">{product.quantity}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium",
                        status.color
                      )}>
                        <status.icon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-2">
                        <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
