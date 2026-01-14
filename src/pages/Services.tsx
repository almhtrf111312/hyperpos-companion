import { useState, useEffect } from 'react';
import { 
  Search, 
  Plus,
  Phone,
  Calendar,
  Wrench,
  Clock,
  CheckCircle,
  Eye,
  Edit,
  Trash2,
  Save,
  User,
  Smartphone,
  AlertCircle,
  XCircle,
  DollarSign,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';
import { EVENTS } from '@/lib/events';

interface RepairRequest {
  id: string;
  customerName: string;
  customerPhone: string;
  deviceType: string;
  deviceModel: string;
  issue: string;
  diagnosis?: string;
  estimatedCost?: number;
  finalCost?: number;
  status: 'pending' | 'in_progress' | 'waiting_parts' | 'completed' | 'cancelled' | 'delivered';
  createdAt: string;
  estimatedDate?: string;
  completedAt?: string;
  notes?: string;
  technician?: string;
}

const SERVICES_STORAGE_KEY = 'hyperpos_services_v1';

// Load services from localStorage
const loadServices = (): RepairRequest[] => {
  try {
    const stored = localStorage.getItem(SERVICES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Save services to localStorage
const saveServices = (services: RepairRequest[]) => {
  try {
    localStorage.setItem(SERVICES_STORAGE_KEY, JSON.stringify(services));
    window.dispatchEvent(new CustomEvent(EVENTS.SERVICES_UPDATED, { detail: services }));
  } catch {
    // ignore
  }
};

const statusConfig = {
  pending: { label: 'قيد الانتظار', icon: Clock, color: 'badge-warning' },
  in_progress: { label: 'قيد الإصلاح', icon: Wrench, color: 'badge-info' },
  waiting_parts: { label: 'بانتظار قطع', icon: AlertCircle, color: 'badge-warning' },
  completed: { label: 'مكتمل', icon: CheckCircle, color: 'badge-success' },
  cancelled: { label: 'ملغي', icon: XCircle, color: 'badge-danger' },
  delivered: { label: 'تم التسليم', icon: CheckCircle, color: 'badge-success' },
};

const filterOptions = ['الكل', 'قيد الانتظار', 'قيد الإصلاح', 'بانتظار قطع', 'مكتمل', 'تم التسليم', 'ملغي'];

const deviceTypes = ['هاتف', 'تابلت', 'لابتوب', 'كمبيوتر', 'ساعة ذكية', 'أخرى'];

export default function Services() {
  const [requests, setRequests] = useState<RepairRequest[]>(() => loadServices());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('الكل');
  
  // Save to localStorage whenever requests change
  useEffect(() => {
    saveServices(requests);
  }, [requests]);
  
  // Dialogs
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RepairRequest | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    deviceType: 'هاتف',
    deviceModel: '',
    issue: '',
    diagnosis: '',
    estimatedCost: 0,
    estimatedDate: '',
    notes: '',
    technician: '',
  });

  const filterStatusMap: Record<string, string | null> = {
    'الكل': null,
    'قيد الانتظار': 'pending',
    'قيد الإصلاح': 'in_progress',
    'بانتظار قطع': 'waiting_parts',
    'مكتمل': 'completed',
    'تم التسليم': 'delivered',
    'ملغي': 'cancelled',
  };

  const filteredRequests = requests.filter(request => {
    const matchesSearch = request.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         request.customerPhone.includes(searchQuery) ||
                         request.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         request.deviceModel.toLowerCase().includes(searchQuery.toLowerCase());
    const filterStatus = filterStatusMap[selectedFilter];
    const matchesFilter = !filterStatus || request.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    inProgress: requests.filter(r => r.status === 'in_progress' || r.status === 'waiting_parts').length,
    completed: requests.filter(r => r.status === 'completed' || r.status === 'delivered').length,
  };

  const resetForm = () => {
    setFormData({
      customerName: '',
      customerPhone: '',
      deviceType: 'هاتف',
      deviceModel: '',
      issue: '',
      diagnosis: '',
      estimatedCost: 0,
      estimatedDate: '',
      notes: '',
      technician: '',
    });
  };

  const handleAddRequest = () => {
    if (!formData.customerName || !formData.customerPhone || !formData.deviceModel || !formData.issue) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    const newRequest: RepairRequest = {
      id: `REP_${Date.now()}`,
      customerName: formData.customerName,
      customerPhone: formData.customerPhone,
      deviceType: formData.deviceType,
      deviceModel: formData.deviceModel,
      issue: formData.issue,
      diagnosis: formData.diagnosis || undefined,
      estimatedCost: formData.estimatedCost || undefined,
      estimatedDate: formData.estimatedDate || undefined,
      notes: formData.notes || undefined,
      technician: formData.technician || undefined,
      status: 'pending',
      createdAt: new Date().toISOString().split('T')[0],
    };

    setRequests([newRequest, ...requests]);
    setShowAddDialog(false);
    resetForm();
    toast.success('تم إضافة طلب الصيانة بنجاح');
  };

  const handleEditRequest = () => {
    if (!selectedRequest || !formData.customerName) {
      toast.error('يرجى ملء الحقول المطلوبة');
      return;
    }

    setRequests(requests.map(r => 
      r.id === selectedRequest.id 
        ? { 
            ...r, 
            customerName: formData.customerName,
            customerPhone: formData.customerPhone,
            deviceType: formData.deviceType,
            deviceModel: formData.deviceModel,
            issue: formData.issue,
            diagnosis: formData.diagnosis || undefined,
            estimatedCost: formData.estimatedCost || undefined,
            estimatedDate: formData.estimatedDate || undefined,
            notes: formData.notes || undefined,
            technician: formData.technician || undefined,
          }
        : r
    ));
    setShowEditDialog(false);
    setSelectedRequest(null);
    resetForm();
    toast.success('تم تحديث طلب الصيانة بنجاح');
  };

  const handleDeleteRequest = () => {
    if (!selectedRequest) return;
    
    setRequests(requests.filter(r => r.id !== selectedRequest.id));
    setShowDeleteDialog(false);
    setSelectedRequest(null);
    toast.success('تم حذف طلب الصيانة بنجاح');
  };

  const handleUpdateStatus = (request: RepairRequest, newStatus: RepairRequest['status']) => {
    const updates: Partial<RepairRequest> = { status: newStatus };
    
    if (newStatus === 'completed') {
      updates.completedAt = new Date().toISOString().split('T')[0];
    }

    setRequests(requests.map(r => 
      r.id === request.id ? { ...r, ...updates } : r
    ));
    toast.success(`تم تحديث الحالة إلى "${statusConfig[newStatus].label}"`);
  };

  const openEditDialog = (request: RepairRequest) => {
    setSelectedRequest(request);
    setFormData({
      customerName: request.customerName,
      customerPhone: request.customerPhone,
      deviceType: request.deviceType,
      deviceModel: request.deviceModel,
      issue: request.issue,
      diagnosis: request.diagnosis || '',
      estimatedCost: request.estimatedCost || 0,
      estimatedDate: request.estimatedDate || '',
      notes: request.notes || '',
      technician: request.technician || '',
    });
    setShowEditDialog(true);
  };

  const openViewDialog = (request: RepairRequest) => {
    setSelectedRequest(request);
    setShowViewDialog(true);
  };

  const openDeleteDialog = (request: RepairRequest) => {
    setSelectedRequest(request);
    setShowDeleteDialog(true);
  };

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-foreground">إدارة الصيانة</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">تتبع وإدارة طلبات إصلاح الأجهزة</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => {
          resetForm();
          setShowAddDialog(true);
        }}>
          <Plus className="w-4 h-4 md:w-5 md:h-5 ml-2" />
          طلب صيانة جديد
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-primary/10">
              <FileText className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs md:text-sm text-muted-foreground">إجمالي الطلبات</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-warning/10">
              <Clock className="w-4 h-4 md:w-5 md:h-5 text-warning" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">{stats.pending}</p>
              <p className="text-xs md:text-sm text-muted-foreground">قيد الانتظار</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-info/10">
              <Wrench className="w-4 h-4 md:w-5 md:h-5 text-info" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">{stats.inProgress}</p>
              <p className="text-xs md:text-sm text-muted-foreground">قيد الإصلاح</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-success/10">
              <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-success" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">{stats.completed}</p>
              <p className="text-xs md:text-sm text-muted-foreground">مكتملة</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="بحث بالاسم أو رقم الطلب أو الجهاز..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9 md:pr-10 bg-muted border-0"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {filterOptions.map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={cn(
                "px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-medium whitespace-nowrap transition-all flex-shrink-0",
                selectedFilter === filter
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Requests List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {filteredRequests.map((request, index) => {
          const status = statusConfig[request.status];
          const StatusIcon = status.icon;

          return (
            <div 
              key={request.id}
              className="bg-card rounded-xl md:rounded-2xl border border-border p-4 md:p-6 card-hover fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3 md:mb-4">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-primary flex items-center justify-center">
                    <Smartphone className="w-5 h-5 md:w-6 md:h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm md:text-base">{request.customerName}</h3>
                    <p className="text-xs md:text-sm text-muted-foreground font-mono">{request.id}</p>
                  </div>
                </div>
                <span className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium",
                  status.color
                )}>
                  <StatusIcon className="w-2.5 h-2.5 md:w-3 md:h-3" />
                  {status.label}
                </span>
              </div>

              {/* Device Info */}
              <div className="space-y-2 mb-3 md:mb-4">
                <div className="flex items-center gap-2 text-xs md:text-sm">
                  <Smartphone className="w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground" />
                  <span className="text-foreground font-medium">{request.deviceType} - {request.deviceModel}</span>
                </div>
                <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                  <Phone className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span>{request.customerPhone}</span>
                </div>
                <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span>{request.createdAt}</span>
                </div>
              </div>

              {/* Issue */}
              <div className="p-3 bg-muted rounded-lg mb-3 md:mb-4">
                <p className="text-xs text-muted-foreground mb-1">المشكلة:</p>
                <p className="text-sm font-medium text-foreground">{request.issue}</p>
              </div>

              {/* Cost */}
              {(request.estimatedCost || request.finalCost) && (
                <div className="flex items-center justify-between mb-3 md:mb-4 p-2 bg-primary/10 rounded-lg">
                  <span className="text-xs md:text-sm text-muted-foreground">
                    {request.finalCost ? 'التكلفة النهائية' : 'التكلفة المتوقعة'}
                  </span>
                  <span className="font-bold text-primary">
                    ${request.finalCost || request.estimatedCost}
                  </span>
                </div>
              )}

              {/* Quick Status Update */}
              {request.status !== 'delivered' && request.status !== 'cancelled' && (
                <div className="flex gap-1 mb-3 md:mb-4 overflow-x-auto pb-1">
                  {request.status === 'pending' && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-xs h-7"
                      onClick={() => handleUpdateStatus(request, 'in_progress')}
                    >
                      بدء الإصلاح
                    </Button>
                  )}
                  {request.status === 'in_progress' && (
                    <>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs h-7"
                        onClick={() => handleUpdateStatus(request, 'waiting_parts')}
                      >
                        انتظار قطع
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs h-7 bg-success/10 text-success border-success/30"
                        onClick={() => handleUpdateStatus(request, 'completed')}
                      >
                        مكتمل
                      </Button>
                    </>
                  )}
                  {request.status === 'waiting_parts' && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-xs h-7"
                      onClick={() => handleUpdateStatus(request, 'in_progress')}
                    >
                      استئناف الإصلاح
                    </Button>
                  )}
                  {request.status === 'completed' && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-xs h-7 bg-success/10 text-success border-success/30"
                      onClick={() => handleUpdateStatus(request, 'delivered')}
                    >
                      تم التسليم
                    </Button>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-border">
                <Button variant="outline" size="sm" className="flex-1 h-8 md:h-9 text-xs md:text-sm" onClick={() => openViewDialog(request)}>
                  <Eye className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1" />
                  عرض
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9" onClick={() => openEditDialog(request)}>
                  <Edit className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9 text-destructive" onClick={() => openDeleteDialog(request)}>
                  <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Request Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              طلب صيانة جديد
            </DialogTitle>
            <DialogDescription>أدخل بيانات طلب الصيانة الجديد</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">اسم العميل *</label>
                <Input
                  placeholder="اسم العميل"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">رقم الهاتف *</label>
                <Input
                  placeholder="+963 xxx xxx xxx"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">نوع الجهاز *</label>
                <select 
                  className="w-full h-10 px-3 rounded-lg bg-muted border-0 text-foreground"
                  value={formData.deviceType}
                  onChange={(e) => setFormData({ ...formData, deviceType: e.target.value })}
                >
                  {deviceTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">موديل الجهاز *</label>
                <Input
                  placeholder="مثال: iPhone 14 Pro"
                  value={formData.deviceModel}
                  onChange={(e) => setFormData({ ...formData, deviceModel: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">المشكلة *</label>
              <Input
                placeholder="وصف المشكلة..."
                value={formData.issue}
                onChange={(e) => setFormData({ ...formData, issue: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">التشخيص المبدئي</label>
              <Input
                placeholder="التشخيص المبدئي..."
                value={formData.diagnosis}
                onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">التكلفة المتوقعة ($)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.estimatedCost || ''}
                  onChange={(e) => setFormData({ ...formData, estimatedCost: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">تاريخ التسليم المتوقع</label>
                <Input
                  type="date"
                  value={formData.estimatedDate}
                  onChange={(e) => setFormData({ ...formData, estimatedDate: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">الفني المسؤول</label>
              <Input
                placeholder="اسم الفني"
                value={formData.technician}
                onChange={(e) => setFormData({ ...formData, technician: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">ملاحظات</label>
              <Input
                placeholder="ملاحظات إضافية..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowAddDialog(false)}>
                إلغاء
              </Button>
              <Button className="flex-1" onClick={handleAddRequest}>
                <Save className="w-4 h-4 ml-2" />
                إضافة الطلب
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Request Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary" />
              تعديل طلب الصيانة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">اسم العميل *</label>
                <Input
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">رقم الهاتف *</label>
                <Input
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">نوع الجهاز *</label>
                <select 
                  className="w-full h-10 px-3 rounded-lg bg-muted border-0 text-foreground"
                  value={formData.deviceType}
                  onChange={(e) => setFormData({ ...formData, deviceType: e.target.value })}
                >
                  {deviceTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">موديل الجهاز *</label>
                <Input
                  value={formData.deviceModel}
                  onChange={(e) => setFormData({ ...formData, deviceModel: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">المشكلة *</label>
              <Input
                value={formData.issue}
                onChange={(e) => setFormData({ ...formData, issue: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">التشخيص</label>
              <Input
                value={formData.diagnosis}
                onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">التكلفة المتوقعة ($)</label>
                <Input
                  type="number"
                  value={formData.estimatedCost || ''}
                  onChange={(e) => setFormData({ ...formData, estimatedCost: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">تاريخ التسليم المتوقع</label>
                <Input
                  type="date"
                  value={formData.estimatedDate}
                  onChange={(e) => setFormData({ ...formData, estimatedDate: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">الفني المسؤول</label>
              <Input
                value={formData.technician}
                onChange={(e) => setFormData({ ...formData, technician: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">ملاحظات</label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowEditDialog(false)}>
                إلغاء
              </Button>
              <Button className="flex-1" onClick={handleEditRequest}>
                <Save className="w-4 h-4 ml-2" />
                حفظ التغييرات
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Request Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" />
              تفاصيل طلب الصيانة
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 py-4">
              {/* Customer Info */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center">
                  <Smartphone className="w-8 h-8 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{selectedRequest.customerName}</h3>
                  <p className="text-muted-foreground">{selectedRequest.customerPhone}</p>
                  <p className="text-sm font-mono text-muted-foreground">{selectedRequest.id}</p>
                </div>
              </div>

              {/* Status */}
              <div className="flex justify-center">
                <span className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium",
                  statusConfig[selectedRequest.status].color
                )}>
                  {(() => {
                    const StatusIcon = statusConfig[selectedRequest.status].icon;
                    return <StatusIcon className="w-4 h-4" />;
                  })()}
                  {statusConfig[selectedRequest.status].label}
                </span>
              </div>

              {/* Device & Issue */}
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الجهاز:</span>
                  <span className="font-medium">{selectedRequest.deviceType} - {selectedRequest.deviceModel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">المشكلة:</span>
                  <span className="font-medium">{selectedRequest.issue}</span>
                </div>
                {selectedRequest.diagnosis && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">التشخيص:</span>
                    <span className="font-medium">{selectedRequest.diagnosis}</span>
                  </div>
                )}
                {selectedRequest.technician && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الفني:</span>
                    <span className="font-medium">{selectedRequest.technician}</span>
                  </div>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">تاريخ الاستلام</p>
                  <p className="font-medium">{selectedRequest.createdAt}</p>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">
                    {selectedRequest.completedAt ? 'تاريخ الإنجاز' : 'التسليم المتوقع'}
                  </p>
                  <p className="font-medium">
                    {selectedRequest.completedAt || selectedRequest.estimatedDate || '-'}
                  </p>
                </div>
              </div>

              {/* Cost */}
              {(selectedRequest.estimatedCost || selectedRequest.finalCost) && (
                <div className="grid grid-cols-2 gap-3">
                  {selectedRequest.estimatedCost && (
                    <div className="bg-warning/10 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">التكلفة المتوقعة</p>
                      <p className="font-bold text-warning">${selectedRequest.estimatedCost}</p>
                    </div>
                  )}
                  {selectedRequest.finalCost && (
                    <div className="bg-success/10 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">التكلفة النهائية</p>
                      <p className="font-bold text-success">${selectedRequest.finalCost}</p>
                    </div>
                  )}
                </div>
              )}

              {selectedRequest.notes && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">ملاحظات:</p>
                  <p className="text-sm">{selectedRequest.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => {
                  setShowViewDialog(false);
                  openEditDialog(selectedRequest);
                }}>
                  <Edit className="w-4 h-4 ml-2" />
                  تعديل
                </Button>
                {selectedRequest.status !== 'cancelled' && selectedRequest.status !== 'delivered' && (
                  <Button 
                    variant="destructive" 
                    className="flex-1"
                    onClick={() => {
                      handleUpdateStatus(selectedRequest, 'cancelled');
                      setShowViewDialog(false);
                    }}
                  >
                    <XCircle className="w-4 h-4 ml-2" />
                    إلغاء الطلب
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف طلب الصيانة "{selectedRequest?.id}" نهائياً. هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRequest} className="bg-destructive hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
