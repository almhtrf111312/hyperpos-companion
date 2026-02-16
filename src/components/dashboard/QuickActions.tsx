import { Link } from 'react-router-dom';
import { ShoppingCart, Plus, Users, CreditCard, Wrench, Package, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import { TranslationKey } from '@/lib/i18n';
import { getVisibleSections } from '@/lib/store-type-config';

interface QuickAction {
  icon: React.ElementType;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  path: string;
  color: 'primary' | 'success' | 'warning' | 'info' | 'accent';
  requiresMaintenance?: boolean;
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
    requiresMaintenance: true,
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

const iconBgStyles = {
  primary: 'bg-primary/15 text-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  info: 'bg-info/15 text-info',
  accent: 'bg-accent/15 text-accent',
};

export function QuickActions() {
  const { t, tDynamic, storeType } = useLanguage();
  const visibleSections = getVisibleSections(storeType);
  const filteredActions = actions.filter(a => !a.requiresMaintenance || visibleSections.maintenance);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
      {filteredActions.map((action, index) => (
        <Link
          key={action.path}
          to={action.path}
          className="flex flex-col items-center gap-1.5 min-w-[60px] group fade-in"
          style={{ animationDelay: `${index * 40}ms` }}
        >
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-110 group-hover:shadow-md",
            iconBgStyles[action.color]
          )}>
            <action.icon className="w-4.5 h-4.5" />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">
            {t(action.labelKey)}
          </span>
        </Link>
      ))}
    </div>
  );
}
