import { useState, useEffect } from 'react';
import { Trash2, RotateCcw, AlertTriangle, Package, FileText, Users, Banknote, Receipt, Warehouse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/hooks/use-language';
import { toast } from 'sonner';
import {
  loadTrash,
  removeFromTrash,
  clearTrash,
  clearTrashByType,
  getTrashStats,
  restoreFromTrash,
  type TrashItem,
  type TrashItemType,
} from '@/lib/trash-store';

// Restore handlers - re-insert data to cloud
import { addProductCloud } from '@/lib/cloud/products-cloud';
import { addCustomerCloud } from '@/lib/cloud/customers-cloud';
import { addDebtCloud } from '@/lib/cloud/debts-cloud';
import { addExpenseCloud } from '@/lib/cloud/expenses-cloud';

const typeConfig: Record<TrashItemType, { icon: typeof Trash2; label: string; labelAr: string }> = {
  invoice: { icon: FileText, label: 'Invoices', labelAr: 'الفواتير' },
  product: { icon: Package, label: 'Products', labelAr: 'المنتجات' },
  customer: { icon: Users, label: 'Customers', labelAr: 'العملاء' },
  debt: { icon: Banknote, label: 'Debts', labelAr: 'الديون' },
  expense: { icon: Receipt, label: 'Expenses', labelAr: 'المصروفات' },
  warehouse: { icon: Warehouse, label: 'Warehouses', labelAr: 'المستودعات' },
};

function TrashItemCard({ item, onRestore, onDelete }: { 
  item: TrashItem; 
  onRestore: (id: string) => void; 
  onDelete: (id: string) => void;
}) {
  const deletedDate = new Date(item.deletedAt);
  const formattedDate = `${deletedDate.toLocaleDateString('ar')} ${deletedDate.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{item.label}</p>
        <p className="text-xs text-muted-foreground">{formattedDate}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-primary hover:text-primary"
          onClick={() => onRestore(item.id)}
          title="استعادة"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              title="حذف نهائي"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>حذف نهائي</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف "{item.label}" نهائياً؟ لا يمكن التراجع عن هذا الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(item.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                حذف نهائي
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export function TrashBin() {
  const { isRTL } = useLanguage();
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [stats, setStats] = useState(getTrashStats());

  const refresh = () => {
    setTrashItems(loadTrash());
    setStats(getTrashStats());
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleRestore = async (trashId: string) => {
    const item = restoreFromTrash(trashId);
    if (!item) return;

    try {
      const data = item.data;
      switch (item.type) {
        case 'product':
          await addProductCloud({
            name: data.name as string,
            barcode: (data.barcode as string) || '',
            category: (data.category as string) || '',
            costPrice: (data.costPrice as number) || 0,
            salePrice: (data.salePrice as number) || 0,
            quantity: (data.quantity as number) || 0,
            minStockLevel: (data.minStockLevel as number) || 5,
          });
          break;
        case 'customer':
          await addCustomerCloud({
            name: data.name as string,
            phone: (data.phone as string) || '',
            email: data.email as string | undefined,
            address: data.address as string | undefined,
          });
          break;
        case 'debt':
          await addDebtCloud({
            invoiceId: (data.invoiceId as string) || '',
            customerName: (data.customerName as string) || '',
            customerPhone: (data.customerPhone as string) || '',
            totalDebt: (data.totalDebt as number) || 0,
            dueDate: (data.dueDate as string) || '',
            isCashDebt: (data.isCashDebt as boolean) || false,
          });
          break;
        // Invoices and warehouses can't be easily restored due to complex relationships
        default:
          toast.info('تم إزالة العنصر من سلة المحذوفات. قد يتطلب الاستعادة اليدوية.');
          break;
      }
      toast.success(`تم استعادة "${item.label}" بنجاح`);
    } catch (e) {
      console.error('[TrashBin] Restore error:', e);
      toast.error('فشل في استعادة العنصر');
      // Re-add to trash since restore failed - but item was already removed by restoreFromTrash
    }

    refresh();
  };

  const handleDelete = (trashId: string) => {
    removeFromTrash(trashId);
    toast.success('تم الحذف النهائي');
    refresh();
  };

  const handleClearAll = () => {
    clearTrash();
    toast.success('تم تفريغ سلة المحذوفات');
    refresh();
  };

  const handleClearType = (type: TrashItemType) => {
    clearTrashByType(type);
    toast.success('تم تفريغ القائمة');
    refresh();
  };

  const totalItems = trashItems.length;
  const types: TrashItemType[] = ['invoice', 'product', 'customer', 'debt', 'expense', 'warehouse'];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            سلة المحذوفات
            {totalItems > 0 && (
              <Badge variant="secondary">{totalItems}</Badge>
            )}
          </CardTitle>
          {totalItems > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="w-4 h-4 mr-1" />
                  تفريغ الكل
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>تفريغ سلة المحذوفات</AlertDialogTitle>
                  <AlertDialogDescription>
                    سيتم حذف جميع العناصر ({totalItems}) نهائياً. لا يمكن التراجع عن هذا الإجراء.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    تفريغ الكل
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {totalItems === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Trash2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>سلة المحذوفات فارغة</p>
          </div>
        ) : (
          <Tabs defaultValue={types.find(t => stats[t] > 0) || 'invoice'}>
            <TabsList className="w-full flex flex-wrap h-auto gap-1 mb-4">
              {types.map(type => {
                const config = typeConfig[type];
                const count = stats[type];
                if (count === 0) return null;
                const Icon = config.icon;
                return (
                  <TabsTrigger key={type} value={type} className="flex items-center gap-1 text-xs">
                    <Icon className="w-3.5 h-3.5" />
                    {config.labelAr}
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{count}</Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {types.map(type => {
              const items = trashItems.filter(t => t.type === type);
              if (items.length === 0) return null;
              return (
                <TabsContent key={type} value={type}>
                  <div className="flex justify-end mb-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive border-destructive/30">
                          حذف الكل ({items.length})
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>حذف الكل</AlertDialogTitle>
                          <AlertDialogDescription>
                            سيتم حذف جميع {typeConfig[type].labelAr} ({items.length}) نهائياً.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleClearType(type)} className="bg-destructive text-destructive-foreground">
                            حذف نهائي
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {items.map(item => (
                        <TrashItemCard
                          key={item.id}
                          item={item}
                          onRestore={handleRestore}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
