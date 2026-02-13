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
  primary: 'border-primary/20 hover:border-primary/50 text-primary',
  success: 'border-success/20 hover:border-success/50 text-success',
  warning: 'border-warning/20 hover:border-warning/50 text-warning',
  info: 'border-info/20 hover:border-info/50 text-info',
  accent: 'border-accent/20 hover:border-accent/50 text-accent',
};

export function QuickActions() {
  const { t } = useLanguage();

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-foreground">{t('quickActions.title')}</h3>
      </div>
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        {actions.map((action, index) => (
          <Link
            key={action.path}
            to={action.path}
            className={cn(
              "flex flex-col items-center justify-center gap-2 p-2 rounded-xl border transition-all duration-300 card-hover fade-in relative overflow-hidden group h-24 md:h-28",
              "bg-card/30 backdrop-blur-sm hover:bg-card/50",
              colorStyles[action.color]
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="p-2 rounded-lg bg-background/50 backdrop-blur-md shadow-sm group-hover:scale-110 transition-transform duration-300">
              <action.icon className="w-5 h-5" />
            </div>
            <div className="text-center z-10 w-full px-1">
              <p className="font-semibold text-foreground text-xs md:text-sm whitespace-nowrap overflow-hidden text-ellipsis group-hover:text-primary transition-colors">{t(action.labelKey)}</p>
            </div>
          </Link>
        ))}
        {/* 2 Empty Placeholders for 3x3 Grid */}
        <div className="h-24 md:h-28 rounded-xl border border-dashed border-border/30 bg-muted/5 backdrop-blur-sm flex items-center justify-center opacity-50">
          <span className="sr-only">Empty Slot 1</span>
        </div>
        <div className="h-24 md:h-28 rounded-xl border border-dashed border-border/30 bg-muted/5 backdrop-blur-sm flex items-center justify-center opacity-50">
          <span className="sr-only">Empty Slot 2</span>
        </div>
      </div>
    </div>
  );
}
