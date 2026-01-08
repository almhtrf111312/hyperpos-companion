import { Link } from 'react-router-dom';
import { ShoppingCart, Plus, Users, CreditCard, Wrench, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickAction {
  icon: React.ElementType;
  label: string;
  description: string;
  path: string;
  color: 'primary' | 'success' | 'warning' | 'info' | 'accent';
}

const actions: QuickAction[] = [
  {
    icon: ShoppingCart,
    label: 'فاتورة جديدة',
    description: 'إنشاء فاتورة بيع',
    path: '/pos',
    color: 'primary',
  },
  {
    icon: Plus,
    label: 'منتج جديد',
    description: 'إضافة منتج للمخزن',
    path: '/products/new',
    color: 'success',
  },
  {
    icon: Users,
    label: 'عميل جديد',
    description: 'إضافة عميل',
    path: '/customers/new',
    color: 'info',
  },
  {
    icon: CreditCard,
    label: 'تسجيل دفعة',
    description: 'تسجيل دفعة دين',
    path: '/debts',
    color: 'warning',
  },
  {
    icon: Wrench,
    label: 'طلب صيانة',
    description: 'تسجيل طلب صيانة',
    path: '/services/new',
    color: 'accent',
  },
  {
    icon: Package,
    label: 'جرد المخزون',
    description: 'فحص المخزون',
    path: '/products/inventory',
    color: 'primary',
  },
];

const colorStyles = {
  primary: 'bg-primary/10 text-primary hover:bg-primary/20 border-primary/20',
  success: 'bg-success/10 text-success hover:bg-success/20 border-success/20',
  warning: 'bg-warning/10 text-warning hover:bg-warning/20 border-warning/20',
  info: 'bg-info/10 text-info hover:bg-info/20 border-info/20',
  accent: 'bg-accent/10 text-accent hover:bg-accent/20 border-accent/20',
};

export function QuickActions() {
  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">إجراءات سريعة</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {actions.map((action, index) => (
          <Link
            key={action.label}
            to={action.path}
            className={cn(
              "flex flex-col items-center gap-3 p-4 rounded-xl border transition-all duration-200 card-hover fade-in",
              colorStyles[action.color]
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="p-3 rounded-xl bg-current/10">
              <action.icon className="w-6 h-6" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">{action.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
