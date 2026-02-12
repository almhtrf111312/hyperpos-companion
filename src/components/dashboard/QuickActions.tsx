import { Link } from 'react-router-dom';
import { ShoppingCart, Plus, Users, CreditCard, Wrench, Package, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import { TranslationKey } from '@/lib/i18n';

interface QuickAction {
  icon: React.ElementType;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  path: string;
  color: 'primary' | 'success' | 'warning' | 'info' | 'accent';
}

const actions: QuickAction[] = [
  {
    icon: ShoppingCart,
    labelKey: 'quickActions.newInvoice',
    descriptionKey: 'quickActions.newInvoiceDesc',
    path: '/pos',
    color: 'primary',
  },
  {
    icon: Plus,
    labelKey: 'quickActions.newProduct',
    descriptionKey: 'quickActions.newProductDesc',
    path: '/products?action=new',
    color: 'success',
  },
  {
    icon: Users,
    labelKey: 'quickActions.newCustomer',
    descriptionKey: 'quickActions.newCustomerDesc',
    path: '/customers?action=new',
    color: 'info',
  },
  {
    icon: CreditCard,
    labelKey: 'quickActions.recordPayment',
    descriptionKey: 'quickActions.recordPaymentDesc',
    path: '/debts',
    color: 'warning',
  },
  {
    icon: Wrench,
    labelKey: 'quickActions.maintenanceRequest',
    descriptionKey: 'quickActions.maintenanceRequestDesc',
    path: '/services/new',
    color: 'accent',
  },
  {
    icon: Receipt,
    labelKey: 'quickActions.addExpense',
    descriptionKey: 'quickActions.addExpenseDesc',
    path: '/expenses?action=new',
    color: 'warning',
  },
  {
    icon: Package,
    labelKey: 'quickActions.inventory',
    descriptionKey: 'quickActions.inventoryDesc',
    path: '/reports?tab=products',
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
  const { t } = useLanguage();

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-foreground">{t('quickActions.title')}</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {actions.map((action, index) => (
          <Link
            key={action.path}
            to={action.path}
            className={cn(
              "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200 card-hover fade-in",
              colorStyles[action.color]
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="p-2 rounded-lg bg-current/10">
              <action.icon className="w-5 h-5" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground text-sm">{t(action.labelKey)}</p>
              <p className="text-xs text-muted-foreground/80 mt-0.5 line-clamp-1">{t(action.descriptionKey)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
