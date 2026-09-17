import { useState, useEffect } from 'react';
import { Activity, User, Filter, Trash2, LogIn, LogOut, ShoppingCart, Wrench, CreditCard, Package, Users, Settings, UserPlus, UserMinus, Key, Database, FileText, FileX, Clock, DollarSign, Wallet, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadActivityLogs, clearActivityLogs, ActivityLog, ActivityType, activityTypeLabels } from '@/lib/activity-log';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const activityIcons: Record<ActivityType, typeof Activity> = {
  login: LogIn, logout: LogOut, sale: ShoppingCart, maintenance: Wrench,
  debt_created: CreditCard, debt_paid: CreditCard, debt_payment: CreditCard,
  debt_writeoff: FileX, debt_deleted: FileX,
  product_added: Package, product_updated: Package, product_deleted: Package,
  customer_added: Users, customer_updated: Users, customer_deleted: UserMinus,
  settings_changed: Settings, user_added: UserPlus, user_deleted: UserMinus,
  password_changed: Key, backup_created: Database,
  invoice_created: FileText, invoice_updated: FileText, invoice_deleted: FileX, invoice_refunded: ShoppingCart,
  shift_opened: Clock, shift_closed: Clock,
  capital_added: DollarSign, capital_withdrawn: Wallet,
  expense_added: TrendingUp, expense_deleted: TrendingUp, expense: TrendingUp,
  refund: ShoppingCart,
  partner_investment: TrendingUp, partner_added: UserPlus, partner_updated: Users,
  partner_deleted: UserMinus, partner_withdrawal: Wallet,
};

const activityColors: Record<ActivityType, string> = {
  login: 'bg-green-500/20 text-green-500', logout: 'bg-orange-500/20 text-orange-500', sale: 'bg-blue-500/20 text-blue-500',
  maintenance: 'bg-purple-500/20 text-purple-500',
  debt_created: 'bg-red-500/20 text-red-500', debt_paid: 'bg-green-500/20 text-green-500', debt_payment: 'bg-green-500/20 text-green-500',
  debt_writeoff: 'bg-red-500/20 text-red-500', debt_deleted: 'bg-red-500/20 text-red-500',
  product_added: 'bg-cyan-500/20 text-cyan-500', product_updated: 'bg-yellow-500/20 text-yellow-500', product_deleted: 'bg-red-500/20 text-red-500',
  customer_added: 'bg-indigo-500/20 text-indigo-500', customer_updated: 'bg-yellow-500/20 text-yellow-500', customer_deleted: 'bg-red-500/20 text-red-500',
  settings_changed: 'bg-gray-500/20 text-gray-500',
  user_added: 'bg-green-500/20 text-green-500', user_deleted: 'bg-red-500/20 text-red-500', password_changed: 'bg-amber-500/20 text-amber-500',
  backup_created: 'bg-teal-500/20 text-teal-500',
  invoice_created: 'bg-blue-500/20 text-blue-500', invoice_updated: 'bg-yellow-500/20 text-yellow-500', invoice_deleted: 'bg-red-500/20 text-red-500', invoice_refunded: 'bg-orange-500/20 text-orange-500',
  shift_opened: 'bg-emerald-500/20 text-emerald-500', shift_closed: 'bg-slate-500/20 text-slate-500',
  capital_added: 'bg-green-500/20 text-green-500', capital_withdrawn: 'bg-orange-500/20 text-orange-500',
  expense_added: 'bg-red-500/20 text-red-500', expense_deleted: 'bg-red-500/20 text-red-500', expense: 'bg-red-500/20 text-red-500',
  refund: 'bg-orange-500/20 text-orange-500',
  partner_investment: 'bg-indigo-500/20 text-indigo-500', partner_added: 'bg-green-500/20 text-green-500', partner_updated: 'bg-yellow-500/20 text-yellow-500',
  partner_deleted: 'bg-red-500/20 text-red-500', partner_withdrawal: 'bg-orange-500/20 text-orange-500',
};

export function ActivityLogSection() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filter, setFilter] = useState<ActivityType | 'all'>('all');
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  useEffect(() => { setLogs(loadActivityLogs()); }, []);

  const filteredLogs = filter === 'all' ? logs : logs.filter(log => log.type === filter);

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'الآن';
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    if (hours < 24) return `منذ ${hours} ساعة`;
    if (days < 7) return `منذ ${days} يوم`;
    return date.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleClearLogs = () => { clearActivityLogs(); setLogs([]); setClearDialogOpen(false); };
  const getActivityLabel = (type: ActivityType) => activityTypeLabels[type].ar;

  const activityTypes: (ActivityType | 'all')[] = ['all', 'login', 'logout', 'sale', 'maintenance', 'debt_created', 'debt_paid', 'invoice_created'];

  return (
    <div className="space-y-4 max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary shrink-0" />
          <span>سجل النشاط</span>
        </h2>
        <Button variant="outline" size="sm" onClick={() => setClearDialogOpen(true)} disabled={logs.length === 0} className="h-8 px-2.5 text-xs self-start sm:self-auto">
          <Trash2 className="w-3.5 h-3.5 ml-1.5" />
          <span>مسح السجل</span>
        </Button>
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap items-center gap-1.5 pb-1">
        <div className="flex items-center gap-1 text-xs text-muted-foreground me-1 shrink-0">
          <Filter className="w-3.5 h-3.5" />
          <span>تصفية:</span>
        </div>
        {activityTypes.map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors shrink-0",
              filter === type
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/40"
            )}
          >
            {type === 'all' ? 'الكل' : getActivityLabel(type)}
          </button>
        ))}
      </div>

      {/* Log items */}
      <div className="space-y-2 max-h-[460px] overflow-y-auto">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-xl p-4">
            <Activity className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">لا توجد نشاطات مسجلة</p>
          </div>
        ) : (
          filteredLogs.map(log => {
            const Icon = activityIcons[log.type] || Activity;
            return (
              <div key={log.id} className="flex items-start gap-3 p-3 bg-muted/40 rounded-xl border border-border/40">
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5", activityColors[log.type])}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground text-xs sm:text-sm">{getActivityLabel(log.type)}</span>
                    <span className="text-[11px] text-muted-foreground font-mono shrink-0">{formatDate(log.timestamp)}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-foreground/90 mt-1 leading-relaxed break-words">{log.description}</p>
                  <div className="flex items-center gap-1 mt-1.5 text-muted-foreground text-[11px]">
                    <User className="w-3 h-3" />
                    <span>{log.userName}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="pt-2 border-t border-border/50">
        <p className="text-xs text-muted-foreground">إجمالي النشاطات المسجلة: {logs.length}</p>
      </div>

      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>تأكيد المسح</DialogTitle></DialogHeader>
          <p className="text-muted-foreground py-4">هل أنت متأكد من مسح سجل النشاط بالكامل؟ لا يمكن التراجع عن هذا الإجراء.</p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setClearDialogOpen(false)} className="w-full sm:w-auto">إلغاء</Button>
            <Button variant="destructive" onClick={handleClearLogs} className="w-full sm:w-auto">مسح السجل</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
