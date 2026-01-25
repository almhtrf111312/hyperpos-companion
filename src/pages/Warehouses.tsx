import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Plus, 
  Warehouse, 
  Truck, 
  Edit, 
  Trash2, 
  User,
  Package,
  MapPin,
  Phone
} from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { useWarehouse } from '@/hooks/use-warehouse';
import { 
  Warehouse as WarehouseType,
  addWarehouseCloud,
  updateWarehouseCloud,
  deleteWarehouseCloud,
  loadWarehouseStockCloud
} from '@/lib/cloud/warehouses-cloud';
import { supabase } from '@/integrations/supabase/client';

interface CashierUser {
  id: string;
  email: string;
  full_name: string | null;
}

export default function Warehouses() {
  const { t } = useLanguage();
  const { warehouses, refreshWarehouses, isLoading, ensureMainWarehouse } = useWarehouse();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseType | null>(null);
  const [cashiers, setCashiers] = useState<CashierUser[]>([]);
  const [warehouseStockCounts, setWarehouseStockCounts] = useState<Record<string, number>>({});
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'vehicle' as 'main' | 'vehicle',
    assigned_cashier_id: '',
    address: '',
    phone: ''
  });

  // Load cashiers
  useEffect(() => {
    const loadCashiers = async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('role', 'cashier');

      if (data && !error) {
        // Get profiles for these cashiers
        const userIds = data.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);

        const cashierList: CashierUser[] = data.map(r => ({
          id: r.user_id,
          email: '',
          full_name: profiles?.find(p => p.user_id === r.user_id)?.full_name || null
        }));

        setCashiers(cashierList);
      }
    };

    loadCashiers();
  }, []);

  // Load stock counts for each warehouse
  useEffect(() => {
    const loadStockCounts = async () => {
      const counts: Record<string, number> = {};
      for (const warehouse of warehouses) {
        const stock = await loadWarehouseStockCloud(warehouse.id);
        counts[warehouse.id] = stock.reduce((sum, s) => sum + s.quantity, 0);
      }
      setWarehouseStockCounts(counts);
    };

    if (warehouses.length > 0) {
      loadStockCounts();
    }
  }, [warehouses]);

  // Ensure main warehouse exists on first load
  useEffect(() => {
    if (!isLoading && warehouses.length === 0) {
      ensureMainWarehouse();
    }
  }, [isLoading, warehouses.length, ensureMainWarehouse]);

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'vehicle',
      assigned_cashier_id: '',
      address: '',
      phone: ''
    });
  };

  const handleAdd = async () => {
    if (!formData.name.trim()) {
      toast.error('يرجى إدخال اسم المستودع');
      return;
    }

    const result = await addWarehouseCloud({
      name: formData.name,
      type: formData.type,
      assigned_cashier_id: formData.assigned_cashier_id || null,
      address: formData.address || null,
      phone: formData.phone || null,
      is_default: formData.type === 'main' && warehouses.filter(w => w.type === 'main').length === 0,
      is_active: true
    });

    if (result) {
      toast.success('تم إضافة المستودع بنجاح');
      setIsAddDialogOpen(false);
      resetForm();
      refreshWarehouses();
    } else {
      toast.error('فشل في إضافة المستودع');
    }
  };

  const handleEdit = async () => {
    if (!selectedWarehouse || !formData.name.trim()) return;

    const success = await updateWarehouseCloud(selectedWarehouse.id, {
      name: formData.name,
      type: formData.type,
      assigned_cashier_id: formData.assigned_cashier_id || null,
      address: formData.address || null,
      phone: formData.phone || null
    });

    if (success) {
      toast.success('تم تحديث المستودع بنجاح');
      setIsEditDialogOpen(false);
      setSelectedWarehouse(null);
      resetForm();
      refreshWarehouses();
    } else {
      toast.error('فشل في تحديث المستودع');
    }
  };

  const handleDelete = async (warehouse: WarehouseType) => {
    if (warehouse.type === 'main' && warehouse.is_default) {
      toast.error('لا يمكن حذف المستودع الرئيسي');
      return;
    }

    if (confirm(`هل أنت متأكد من حذف المستودع "${warehouse.name}"?`)) {
      const success = await deleteWarehouseCloud(warehouse.id);
      if (success) {
        toast.success('تم حذف المستودع بنجاح');
        refreshWarehouses();
      } else {
        toast.error('فشل في حذف المستودع');
      }
    }
  };

  const openEditDialog = (warehouse: WarehouseType) => {
    setSelectedWarehouse(warehouse);
    setFormData({
      name: warehouse.name,
      type: warehouse.type as 'main' | 'vehicle',
      assigned_cashier_id: warehouse.assigned_cashier_id || '',
      address: warehouse.address || '',
      phone: warehouse.phone || ''
    });
    setIsEditDialogOpen(true);
  };

  const getCashierName = (cashierId: string | null) => {
    if (!cashierId) return 'غير محدد';
    const cashier = cashiers.find(c => c.id === cashierId);
    return cashier?.full_name || 'موزع';
  };

  const mainWarehouses = warehouses.filter(w => w.type === 'main');
  const vehicleWarehouses = warehouses.filter(w => w.type === 'vehicle');

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">إدارة المستودعات</h1>
            <p className="text-muted-foreground">إدارة المستودعات الرئيسية ومخازن الموزعين</p>
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                إضافة مستودع
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>إضافة مستودع جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>اسم المستودع</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="مثال: سيارة أحمد"
                  />
                </div>
                
                <div>
                  <Label>نوع المستودع</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: 'main' | 'vehicle') => setFormData(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="main">مستودع رئيسي</SelectItem>
                      <SelectItem value="vehicle">مخزن موزع (سيارة)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.type === 'vehicle' && (
                  <div>
                    <Label>الموزع المسؤول</Label>
                    <Select
                      value={formData.assigned_cashier_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_cashier_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الموزع" />
                      </SelectTrigger>
                      <SelectContent>
                        {cashiers.map(cashier => (
                          <SelectItem key={cashier.id} value={cashier.id}>
                            {cashier.full_name || 'موزع'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label>العنوان (اختياري)</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="العنوان"
                  />
                </div>

                <div>
                  <Label>رقم الهاتف (اختياري)</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="رقم الهاتف"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    إلغاء
                  </Button>
                  <Button onClick={handleAdd}>
                    إضافة
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Main Warehouses */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Warehouse className="w-5 h-5" />
            المستودعات الرئيسية
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mainWarehouses.map(warehouse => (
              <Card key={warehouse.id} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Warehouse className="w-5 h-5 text-primary" />
                      {warehouse.name}
                    </CardTitle>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(warehouse)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      {!warehouse.is_default && (
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(warehouse)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {warehouse.is_default && (
                      <Badge variant="secondary">المستودع الافتراضي</Badge>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Package className="w-4 h-4" />
                      <span>{warehouseStockCounts[warehouse.id] || 0} قطعة في المخزون</span>
                    </div>
                    {warehouse.address && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span>{warehouse.address}</span>
                      </div>
                    )}
                    {warehouse.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        <span>{warehouse.phone}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Vehicle Warehouses (Distributors) */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Truck className="w-5 h-5" />
            مخازن الموزعين (السيارات)
          </h2>
          {vehicleWarehouses.length === 0 ? (
            <Card className="p-8 text-center">
              <Truck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">لا توجد مخازن موزعين</p>
              <p className="text-sm text-muted-foreground mt-1">
                أضف مخزن لكل موزع لتتبع العهدة والمبيعات
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vehicleWarehouses.map(warehouse => (
                <Card key={warehouse.id} className="relative">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Truck className="w-5 h-5 text-orange-500" />
                        {warehouse.name}
                      </CardTitle>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(warehouse)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(warehouse)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-primary" />
                        <span className="font-medium">{getCashierName(warehouse.assigned_cashier_id)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Package className="w-4 h-4" />
                        <span>{warehouseStockCounts[warehouse.id] || 0} قطعة في العهدة</span>
                      </div>
                      {warehouse.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="w-4 h-4" />
                          <span>{warehouse.phone}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تعديل المستودع</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>اسم المستودع</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              
              <div>
                <Label>نوع المستودع</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: 'main' | 'vehicle') => setFormData(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main">مستودع رئيسي</SelectItem>
                    <SelectItem value="vehicle">مخزن موزع (سيارة)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.type === 'vehicle' && (
                <div>
                  <Label>الموزع المسؤول</Label>
                  <Select
                    value={formData.assigned_cashier_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_cashier_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الموزع" />
                    </SelectTrigger>
                    <SelectContent>
                      {cashiers.map(cashier => (
                        <SelectItem key={cashier.id} value={cashier.id}>
                          {cashier.full_name || 'موزع'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>العنوان (اختياري)</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>

              <div>
                <Label>رقم الهاتف (اختياري)</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button onClick={handleEdit}>
                  حفظ التغييرات
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
