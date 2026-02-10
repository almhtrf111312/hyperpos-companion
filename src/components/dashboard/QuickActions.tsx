import { Link } from 'react-router-dom';
import { ShoppingCart, Plus, Users, CreditCard, Wrench, Package, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import { TranslationKey } from '@/lib/i18n';
import { AppTooltip } from '@/components/ui/AppTooltip';

interface QuickAction {
  icon: React.ElementType;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  tooltipKey: TranslationKey;
  path: string;
  color: 'primary' | 'success' | 'warning' | 'info' | 'accent';
}

const actions: QuickAction[] = [
  {
    icon: ShoppingCart,
    labelKey: 'quickActions.newInvoice',
    descriptionKey: 'quickActions.newInvoiceDesc',
    tooltipKey: 'tooltip.quick.newInvoice',
    path: '/pos',
    color: 'primary',
  },
  {
    icon: Plus,
    labelKey: 'quickActions.newProduct',
    descriptionKey: 'quickActions.newProductDesc',
    tooltipKey: 'tooltip.quick.newProduct',
    path: '/products?action=new',
    color: 'success',
  },
  {
    icon: Users,
    labelKey: 'quickActions.newCustomer',
    descriptionKey: 'quickActions.newCustomerDesc',
    tooltipKey: 'tooltip.quick.newCustomer',
    path: '/customers?action=new',
    color: 'info',
  },
  {
    icon: CreditCard,
    labelKey: 'quickActions.recordPayment',
    descriptionKey: 'quickActions.recordPaymentDesc',
    tooltipKey: 'tooltip.quick.recordPayment',
    path: '/debts',
    color: 'warning',
  },
  {
    icon: Wrench,
    labelKey: 'quickActions.maintenanceRequest',
    descriptionKey: 'quickActions.maintenanceRequestDesc',
    tooltipKey: 'tooltip.quick.maintenance',
    path: '/services/new',
    color: 'accent',
  },
  {
    icon: Receipt,
    labelKey: 'quickActions.addExpense',
    descriptionKey: 'quickActions.addExpenseDesc',
    tooltipKey: 'tooltip.quick.addExpense',
    path: '/expenses?action=new',
    color: 'warning',
  },
  {
    icon: Package,
    labelKey: 'quickActions.inventory',
    descriptionKey: 'quickActions.inventoryDesc',
    tooltipKey: 'tooltip.quick.inventory',
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
    <div className="bg-card rounded-xl border border-border p-3">
      <h3 className="text-sm font-semibold text-foreground mb-2">{t('quickActions.title')}</h3>
      <div className="grid grid-cols-4 gap-2">
        {actions.map((action, index) => (
          <AppTooltip key={action.path} tooltipKey={action.tooltipKey}>
            <Link
              to={action.path}
              className={cn(
                "flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all duration-200 card-hover",
                colorStyles[action.color]
              )}
            >
              <action.icon className="w-4 h-4" />
              <p className="font-medium text-foreground text-[10px] sm:text-xs text-center leading-tight">{t(action.labelKey)}</p>
            </Link>
          </AppTooltip>
        ))}
      </div>
    </div>
  );
}

