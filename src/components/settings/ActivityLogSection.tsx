import { useState, useEffect } from 'react';
import { Activity, User, Filter, Trash2, LogIn, LogOut, ShoppingCart, Wrench, CreditCard, Package, Users, Settings, UserPlus, UserMinus, Key, Database, FileText, FileX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadActivityLogs, clearActivityLogs, ActivityLog, ActivityType, activityTypeLabels } from '@/lib/activity-log';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const activityIcons: Record<ActivityType, typeof Activity> = {
  login: LogIn, logout: LogOut, sale: ShoppingCart, maintenance: Wrench, debt_created: CreditCard, debt_paid: CreditCard,
  product_added: Package, product_updated: Package, product_deleted: Package, customer_added: Users, customer_updated: Users,
  settings_changed: Settings, user_added: UserPlus, user_deleted: UserMinus, password_changed: Key, backup_created: Database,
  invoice_created: FileText, invoice_deleted: FileX,
};

const activityColors: Record<ActivityType, string> = {
  login: 'bg-green-500/20 text-green-500', logout: 'bg-orange-500/20 text-orange-500', sale: 'bg-blue-500/20 text-blue-500',
  maintenance: 'bg-purple-500/20 text-purple-500', debt_created: 'bg-red-500/20 text-red-500', debt_paid: 'bg-green-500/20 text-green-500',
  product_added: 'bg-cyan-500/20 text-cyan-500', product_updated: 'bg-yellow-500/20 text-yellow-500', product_deleted: 'bg-red-500/20 text-red-500',
  customer_added: 'bg-indigo-500/20 text-indigo-500', customer_updated: 'bg-yellow-500/20 text-yellow-500', settings_changed: 'bg-gray-500/20 text-gray-500',
  user_added: 'bg-green-500/20 text-green-500', user_deleted: 'bg-red-500/20 text-red-500', password_changed: 'bg-amber-500/20 text-amber-500',
  backup_created: 'bg-teal-500/20 text-teal-500', invoice_created: 'bg-blue-500/20 text-blue-500', invoice_deleted: 'bg-red-500/20 text-red-500',
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
    <div className="bg-card rounded-2xl border border-border p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-lg md:text-xl font-bold text-foreground flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />سجل النشاط
        </h2>
        <Button variant="outline" size="sm" onClick={() => setClearDialogOpen(true)} disabled={logs.length === 0}>
          <Trash2 className="w-4 h-4 ml-2" />مسح السجل
        </Button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <div className="flex gap-2">
          {activityTypes.map(type => (
            <button key={type} onClick={() => setFilter(type)} className={cn("px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors", filter === type ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
              {type === 'all' ? 'الكل' : getActivityLabel(type)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground"><Activity className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>لا يوجد نشاط</p></div>
        ) : (
          filteredLogs.map(log => {
            const Icon = activityIcons[log.type] || Activity;
            return (
              <div key={log.id} className="flex items-start gap-3 p-3 bg-muted rounded-xl">
                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", activityColors[log.type])}><Icon className="w-5 h-5" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground text-sm">{getActivityLabel(log.type)}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(log.timestamp)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 truncate">{log.description}</p>
                  <div className="flex items-center gap-1 mt-1"><User className="w-3 h-3 text-muted-foreground" /><span className="text-xs text-muted-foreground">{log.userName}</span></div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="pt-4 border-t border-border"><p className="text-sm text-muted-foreground">إجمالي النشاطات: {logs.length}</p></div>

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
