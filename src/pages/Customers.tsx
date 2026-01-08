import { useState } from 'react';
import { 
  Search, 
  Plus, 
  User,
  Phone,
  Mail,
  MapPin,
  Edit,
  Trash2,
  Eye,
  CreditCard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  totalPurchases: number;
  totalDebt: number;
  invoiceCount: number;
  lastPurchase: string;
}

const mockCustomers: Customer[] = [
  { id: '1', name: 'محمد أحمد', phone: '+963 912 345 678', email: 'mohamed@email.com', address: 'دمشق، شارع النيل', totalPurchases: 15000, totalDebt: 2500, invoiceCount: 12, lastPurchase: '2025-01-08' },
  { id: '2', name: 'علي حسن', phone: '+963 998 765 432', email: 'ali@email.com', totalPurchases: 8500, totalDebt: 0, invoiceCount: 8, lastPurchase: '2025-01-07' },
  { id: '3', name: 'فاطمة محمود', phone: '+963 933 111 222', address: 'حلب، شارع الحرية', totalPurchases: 22000, totalDebt: 5000, invoiceCount: 18, lastPurchase: '2025-01-06' },
  { id: '4', name: 'خالد عمر', phone: '+963 944 555 666', email: 'khaled@email.com', totalPurchases: 5200, totalDebt: 850, invoiceCount: 5, lastPurchase: '2025-01-05' },
  { id: '5', name: 'سارة يوسف', phone: '+963 955 888 999', totalPurchases: 18000, totalDebt: 0, invoiceCount: 15, lastPurchase: '2025-01-04' },
  { id: '6', name: 'أحمد سالم', phone: '+963 966 222 333', email: 'ahmed@email.com', address: 'اللاذقية', totalPurchases: 3500, totalDebt: 1200, invoiceCount: 3, lastPurchase: '2025-01-03' },
];

export default function Customers() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCustomers = mockCustomers.filter(customer =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone.includes(searchQuery)
  );

  const stats = {
    total: mockCustomers.length,
    withDebt: mockCustomers.filter(c => c.totalDebt > 0).length,
    totalDebt: mockCustomers.reduce((sum, c) => sum + c.totalDebt, 0),
    totalPurchases: mockCustomers.reduce((sum, c) => sum + c.totalPurchases, 0),
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">إدارة العملاء</h1>
          <p className="text-muted-foreground mt-1">قائمة العملاء والديون</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="w-5 h-5 ml-2" />
          إضافة عميل
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-sm text-muted-foreground">إجمالي العملاء</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <CreditCard className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.withDebt}</p>
              <p className="text-sm text-muted-foreground">عملاء مدينون</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <CreditCard className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">${stats.totalDebt.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">إجمالي الديون</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <CreditCard className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">${stats.totalPurchases.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">إجمالي المشتريات</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="بحث بالاسم أو رقم الهاتف..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pr-10 bg-muted border-0"
        />
      </div>

      {/* Customers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map((customer, index) => (
          <div 
            key={customer.id}
            className="bg-card rounded-2xl border border-border p-6 card-hover fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Customer Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center">
                  <span className="text-lg font-bold text-primary-foreground">
                    {customer.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{customer.name}</h3>
                  <p className="text-sm text-muted-foreground">{customer.invoiceCount} فاتورة</p>
                </div>
              </div>
              {customer.totalDebt > 0 && (
                <span className="px-3 py-1 rounded-full text-xs font-medium badge-warning">
                  مدين
                </span>
              )}
            </div>

            {/* Contact Info */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-4 h-4" />
                <span>{customer.phone}</span>
              </div>
              {customer.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <span>{customer.email}</span>
                </div>
              )}
              {customer.address && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span>{customer.address}</span>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 py-4 border-t border-border">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المشتريات</p>
                <p className="text-lg font-bold text-foreground">${customer.totalPurchases.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">الديون المستحقة</p>
                <p className={cn(
                  "text-lg font-bold",
                  customer.totalDebt > 0 ? "text-destructive" : "text-success"
                )}>
                  ${customer.totalDebt.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t border-border">
              <Button variant="outline" size="sm" className="flex-1">
                <Eye className="w-4 h-4 ml-1" />
                عرض
              </Button>
              <Button variant="outline" size="sm" className="flex-1">
                <Edit className="w-4 h-4 ml-1" />
                تعديل
              </Button>
              <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive hover:text-destructive-foreground">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
