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
  phone: string | null;
  user_type: 'cashier' | 'distributor';
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

  // Load cashiers belonging to current owner only
  useEffect(() => {
    const loadCashiers = async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get cashiers that belong to this owner (owner_id = current user)
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role, owner_id')
        .eq('role', 'cashier')
        .eq('owner_id', user.id);

      if (data && !error) {
        // Get profiles for these cashiers (with phone and user_type)
        const userIds = data.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, phone, user_type')
          .in('user_id', userIds);

        // Get emails via edge function
        try {
          const { data: authData } = await supabase.functions.invoke('get-users-with-emails');
          const emailMap = new Map<string, string>(
            authData?.users?.map((u: { user_id: string; email: string }) => [u.user_id, u.email]) || []
          );

          // Filter only distributors for warehouse assignment
          const distributorProfiles = profiles?.filter(p => p.user_type === 'distributor') || [];
          
          const cashierList: CashierUser[] = distributorProfiles.map(p => ({
            id: p.user_id,
            email: emailMap.get(p.user_id) || '',
            full_name: p.full_name || null,
            phone: p.phone || null,
            user_type: (p.user_type as 'cashier' | 'distributor') || 'cashier'
          }));

          setCashiers(cashierList);
        } catch (err) {
          // Fallback without emails - still filter by distributor
          const distributorProfiles = profiles?.filter(p => p.user_type === 'distributor') || [];
          
          const cashierList: CashierUser[] = distributorProfiles.map(p => ({
            id: p.user_id,
            email: '',
            full_name: p.full_name || null,
            phone: p.phone || null,
            user_type: (p.user_type as 'cashier' | 'distributor') || 'cashier'
          }));
          setCashiers(cashierList);
        }
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

  // Auto-fill warehouse data when distributor is selected
  const handleCashierSelect = (cashierId: string) => {
    const selectedCashier = cashiers.find(c => c.id === cashierId);
    
    if (selectedCashier) {
      setFormData(prev => ({
        ...prev,
        assigned_cashier_id: cashierId,
        // Auto-fill name and phone from distributor's profile
        name: `مخزن ${selectedCashier.full_name || 'الموزع'}`,
        phone: selectedCashier.phone || prev.phone,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        assigned_cashier_id: cashierId,
      }));
    }
  };

  const handleAdd = async () => {
    if (!formData.name.trim()) {
      toast.error('يرجى إدخال اسم المستودع');
      return;
    }

    if (!formData.assigned_cashier_id) {
      toast.error('يرجى اختيار الموزع');
      return;
    }

    // Get phone from selected distributor
    const selectedDistributor = cashiers.find(c => c.id === formData.assigned_cashier_id);

    const result = await addWarehouseCloud({
      name: formData.name,
      type: 'vehicle', // Always vehicle type for new warehouses
      assigned_cashier_id: formData.assigned_cashier_id,
      address: formData.address || null,
      phone: selectedDistributor?.phone || null,
      is_default: false,
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
    // Count main warehouses
    const mainWarehousesCount = warehouses.filter(w => w.type === 'main').length;
    
    // Only prevent deletion if it's the ONLY main warehouse
    if (warehouse.type === 'main' && mainWarehousesCount === 1) {
      toast.error('لا يمكن حذف المستودع الرئيسي الوحيد');
      return;
    }

    // Check for stock in warehouse
    const stock = await loadWarehouseStockCloud(warehouse.id);
    const totalStock = stock.reduce((sum, s) => sum + s.quantity, 0);
    
    let confirmMessage = `هل أنت متأكد من حذف المستودع "${warehouse.name}"?`;
    if (totalStock > 0) {
      confirmMessage = `تحذير: يوجد ${totalStock} منتج في هذا المستودع.\n${confirmMessage}`;
    }

    if (confirm(confirmMessage)) {
      try {
        // First, delete related stock transfer items and transfers
        const { data: transfers } = await supabase
          .from('stock_transfers')
          .select('id')
          .or(`from_warehouse_id.eq.${warehouse.id},to_warehouse_id.eq.${warehouse.id}`);

        if (transfers && transfers.length > 0) {
          const transferIds = transfers.map(t => t.id);
          
          // Delete transfer items first
          await supabase
            .from('stock_transfer_items')
            .delete()
            .in('transfer_id', transferIds);
          
          // Delete transfers
          await supabase
            .from('stock_transfers')
            .delete()
            .or(`from_warehouse_id.eq.${warehouse.id},to_warehouse_id.eq.${warehouse.id}`);
        }

        // Delete warehouse stock
        await supabase
          .from('warehouse_stock')
          .delete()
          .eq('warehouse_id', warehouse.id);

        // Finally delete the warehouse
        const success = await deleteWarehouseCloud(warehouse.id);
        if (success) {
          toast.success('تم حذف المستودع بنجاح');
          refreshWarehouses();
        } else {
          toast.error('فشل في حذف المستودع');
        }
      } catch (error) {
        console.error('[Warehouses] Delete error:', error);
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
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>إضافة مستودع موزع</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Distributor Select - Primary Field */}
                <div>
                  <Label>اختر الموزع</Label>
                  {cashiers.length === 0 ? (
                    <div className="p-4 border rounded-lg bg-muted/50 text-center mt-2">
                      <User className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">لا يوجد موزعين</p>
                      <Button 
                        variant="link" 
                        size="sm"
                        onClick={() => window.location.href = '/settings?tab=users'}
                      >
                        إضافة موزع من الإعدادات
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={formData.assigned_cashier_id}
                      onValueChange={handleCashierSelect}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="انقر لاختيار الموزع" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        {cashiers.map(cashier => (
                          <SelectItem key={cashier.id} value={cashier.id}>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span>{cashier.full_name || 'موزع'}</span>
                              {cashier.phone && (
                                <span className="text-xs text-muted-foreground">({cashier.phone})</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Auto-filled Name (editable) */}
                {formData.assigned_cashier_id && (
                  <div>
                    <Label>اسم المستودع</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="سيتم ملؤه تلقائياً"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      تم ملء الاسم تلقائياً، يمكنك تعديله
                    </p>
                  </div>
                )}

                {/* Optional Address */}
                <div>
                  <Label>العنوان <span className="text-muted-foreground text-xs">(اختياري)</span></Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="العنوان"
                    className="mt-1"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); resetForm(); }}>
                    إلغاء
                  </Button>
                  <Button 
                    onClick={handleAdd}
                    disabled={!formData.assigned_cashier_id || !formData.name.trim()}
                  >
                    إضافة المستودع
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
                  {cashiers.length === 0 ? (
                    <div className="p-3 border rounded-md bg-muted/50 text-center">
                      <p className="text-sm text-muted-foreground">لا يوجد موزعين</p>
                      <Button 
                        variant="link" 
                        size="sm"
                        onClick={() => window.location.href = '/settings?tab=users'}
                      >
                        إضافة موزع جديد من الإعدادات
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Select
                        value={formData.assigned_cashier_id}
                        onValueChange={handleCashierSelect}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الموزع" />
                        </SelectTrigger>
                        <SelectContent>
                          {cashiers.map(cashier => (
                            <SelectItem key={cashier.id} value={cashier.id}>
                              <div className="flex flex-col items-start">
                                <span>{cashier.full_name || 'موزع'}</span>
                                <span className="text-xs text-muted-foreground">
                                  {cashier.email}{cashier.phone && ` • ${cashier.phone}`}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}
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
