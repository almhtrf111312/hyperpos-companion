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
import { DatePicker } from '@/components/ui/date-picker';
import { toast } from 'sonner';
import { EVENTS } from '@/lib/events';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';

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
  // Delivery fields
  partsCost?: number;        // تكلفة القطع علينا
  amountReceived?: number;   // المبلغ المقبوض من العميل
  profit?: number;           // الربح الصافي
  paymentType?: 'cash' | 'debt';  // نوع الدفع
  deliveredAt?: string;      // تاريخ التسليم
  // Cashier attribution
  createdById?: string;
  createdByName?: string;
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

const getStatusConfig = (t: (key: string) => string) => ({
  pending: { label: t('services.pending'), icon: Clock, color: 'badge-warning' },
  in_progress: { label: t('services.inProgress'), icon: Wrench, color: 'badge-info' },
  waiting_parts: { label: t('services.waitingParts'), icon: AlertCircle, color: 'badge-warning' },
  completed: { label: t('services.completed'), icon: CheckCircle, color: 'badge-success' },
  cancelled: { label: t('services.cancelled'), icon: XCircle, color: 'badge-danger' },
  delivered: { label: t('services.delivered'), icon: CheckCircle, color: 'badge-success' },
});

const getFilterOptions = (t: (key: string) => string) => [
  { key: 'all', label: t('services.all') },
  { key: 'pending', label: t('services.pending') },
  { key: 'in_progress', label: t('services.inProgress') },
  { key: 'waiting_parts', label: t('services.waitingParts') },
  { key: 'completed', label: t('services.completed') },
  { key: 'delivered', label: t('services.delivered') },
  { key: 'cancelled', label: t('services.cancelled') },
];

const getDeviceTypes = (t: (key: string) => string) => [
  { key: 'phone', label: t('services.deviceTypes.phone') },
  { key: 'tablet', label: t('services.deviceTypes.tablet') },
  { key: 'laptop', label: t('services.deviceTypes.laptop') },
  { key: 'computer', label: t('services.deviceTypes.computer') },
  { key: 'smartwatch', label: t('services.deviceTypes.smartwatch') },
  { key: 'other', label: t('services.deviceTypes.other') },
];

export default function Services() {
  const { t } = useLanguage();
  const { user, profile } = useAuth();
  const statusConfig = getStatusConfig(t);
  const filterOptions = getFilterOptions(t);
  const deviceTypes = getDeviceTypes(t);

  const [requests, setRequests] = useState<RepairRequest[]>(() => loadServices());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');

  // Save to localStorage whenever requests change
  useEffect(() => {
    saveServices(requests);
  }, [requests]);

  // Dialogs
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeliveryDialog, setShowDeliveryDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RepairRequest | null>(null);

  // Delivery form state
  const [deliveryData, setDeliveryData] = useState({
    partsCost: 0,
    amountReceived: 0,
    paymentType: 'cash' as 'cash' | 'debt',
  });

  // Form state
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    deviceType: 'phone',
    deviceModel: '',
    issue: '',
    diagnosis: '',
    estimatedCost: 0,
    estimatedDate: '',
    notes: '',
    technician: '',
  });

  const filterStatusMap: Record<string, string | null> = {
    'all': null,
    'pending': 'pending',
    'in_progress': 'in_progress',
    'waiting_parts': 'waiting_parts',
    'completed': 'completed',
    'delivered': 'delivered',
    'cancelled': 'cancelled',
  };

  const filteredRequests = requests.filter(request => {
    const matchesSearch = request.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.customerPhone.includes(searchQuery) ||
      request.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.deviceModel.toLowerCase().includes(searchQuery.toLowerCase());
    const filterStatus = filterStatusMap[selectedFilter] || null;
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
      deviceType: 'phone',
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
      toast.error(t('services.fillAllFields'));
      return;
    }

    const deviceLabel = deviceTypes.find(d => d.key === formData.deviceType)?.label || formData.deviceType;

    const newRequest: RepairRequest = {
      id: `REP_${Date.now()}`,
      customerName: formData.customerName,
      customerPhone: formData.customerPhone,
      deviceType: deviceLabel,
      deviceModel: formData.deviceModel,
      issue: formData.issue,
      diagnosis: formData.diagnosis || undefined,
      estimatedCost: formData.estimatedCost || undefined,
      estimatedDate: formData.estimatedDate || undefined,
      notes: formData.notes || undefined,
      technician: formData.technician || undefined,
      status: 'pending',
      createdAt: new Date().toISOString().split('T')[0],
      createdById: user?.id,
      createdByName: profile?.full_name || user?.email?.split('@')[0] || undefined,
    };

    setRequests([newRequest, ...requests]);
    setShowAddDialog(false);
    resetForm();
    toast.success(t('services.requestAdded'));
  };

  const handleEditRequest = () => {
    if (!selectedRequest || !formData.customerName) {
      toast.error(t('services.fillAllFields'));
      return;
    }

    const deviceLabel = deviceTypes.find(d => d.key === formData.deviceType)?.label || formData.deviceType;

    setRequests(requests.map(r =>
      r.id === selectedRequest.id
        ? {
          ...r,
          customerName: formData.customerName,
          customerPhone: formData.customerPhone,
          deviceType: deviceLabel,
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
    toast.success(t('services.requestUpdated'));
  };

  const handleDeleteRequest = () => {
    if (!selectedRequest) return;

    setRequests(requests.filter(r => r.id !== selectedRequest.id));
    setShowDeleteDialog(false);
    setSelectedRequest(null);
    toast.success(t('services.requestDeleted'));
  };

  const handleUpdateStatus = (request: RepairRequest, newStatus: RepairRequest['status']) => {
    // If status is being changed to delivered, open delivery dialog
    if (newStatus === 'delivered') {
      setSelectedRequest(request);
      setDeliveryData({
        partsCost: 0,
        amountReceived: request.estimatedCost || 0,
        paymentType: 'cash',
      });
      setShowDeliveryDialog(true);
      return;
    }

    const updates: Partial<RepairRequest> = { status: newStatus };

    if (newStatus === 'completed') {
      updates.completedAt = new Date().toISOString().split('T')[0];
    }

    setRequests(requests.map(r =>
      r.id === request.id ? { ...r, ...updates } : r
    ));
    toast.success(t('services.statusUpdated').replace('{status}', statusConfig[newStatus].label));
  };

  const handleDeliveryConfirm = () => {
    if (!selectedRequest) return;

    const profit = deliveryData.amountReceived - deliveryData.partsCost;

    const updates: Partial<RepairRequest> = {
      status: 'delivered',
      partsCost: deliveryData.partsCost,
      amountReceived: deliveryData.amountReceived,
      profit,
      paymentType: deliveryData.paymentType,
      deliveredAt: new Date().toISOString().split('T')[0],
      finalCost: deliveryData.amountReceived,
    };

    setRequests(requests.map(r =>
      r.id === selectedRequest.id ? { ...r, ...updates } : r
    ));

    setShowDeliveryDialog(false);
    setSelectedRequest(null);

    if (deliveryData.paymentType === 'debt') {
      toast.success(t('services.deliveredDebt').replace('${profit}', String(profit)));
    } else {
      toast.success(t('services.deliveredCash').replace('${profit}', String(profit)));
    }
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-14 md:pr-0">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-foreground">{t('services.title')}</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">{t('services.subtitle')}</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => {
          resetForm();
          setShowAddDialog(true);
        }}>
          <Plus className="w-4 h-4 md:w-5 md:h-5 ml-2" />
          {t('services.newRequest')}
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
              <p className="text-xs md:text-sm text-muted-foreground">{t('services.totalRequests')}</p>
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
              <p className="text-xs md:text-sm text-muted-foreground">{t('services.pending')}</p>
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
              <p className="text-xs md:text-sm text-muted-foreground">{t('services.inProgress')}</p>
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
              <p className="text-xs md:text-sm text-muted-foreground">{t('services.completed')}</p>
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
            placeholder={t('services.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9 md:pr-10 bg-muted border-0"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {filterOptions.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setSelectedFilter(filter.key)}
              className={cn(
                "px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-medium whitespace-nowrap transition-all flex-shrink-0",
                selectedFilter === filter.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {filter.label}
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
                  {request.createdByName && (
                    <span className="flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded text-[10px] md:text-xs">
                      👤 {request.createdByName}
                    </span>
                  )}
                </div>
              </div>

              {/* Issue */}
              <div className="p-3 bg-muted rounded-lg mb-3 md:mb-4">
                <p className="text-xs text-muted-foreground mb-1">{t('services.issue')}:</p>
                <p className="text-sm font-medium text-foreground">{request.issue}</p>
              </div>

              {/* Cost - For non-delivered */}
              {request.status !== 'delivered' && (request.estimatedCost || request.finalCost) && (
                <div className="flex items-center justify-between mb-3 md:mb-4 p-2 bg-primary/10 rounded-lg">
                  <span className="text-xs md:text-sm text-muted-foreground">
                    {request.finalCost ? t('services.finalCost') : t('services.expectedCost')}
                  </span>
                  <span className="font-bold text-primary">
                    ${request.finalCost || request.estimatedCost}
                  </span>
                </div>
              )}

              {/* Financial info for delivered services */}
              {request.status === 'delivered' && request.amountReceived !== undefined && (
                <div className="p-3 bg-success/10 rounded-lg space-y-2 mb-3 md:mb-4">
                  <div className="flex justify-between text-xs md:text-sm">
                    <span className="text-muted-foreground">{t('services.amountReceived')}:</span>
                    <span className="font-bold text-success">${request.amountReceived}</span>
                  </div>
                  <div className="flex justify-between text-xs md:text-sm">
                    <span className="text-muted-foreground">{t('services.ourCost')}:</span>
                    <span className="text-destructive">-${request.partsCost || 0}</span>
                  </div>
                  <div className="flex justify-between text-xs md:text-sm border-t border-border pt-2">
                    <span className="font-medium">{t('services.netProfit')}:</span>
                    <span className="font-bold text-primary">${request.profit || 0}</span>
                  </div>
                  {request.paymentType === 'debt' && (
                    <div className="flex items-center gap-1 text-xs text-warning">
                      <DollarSign className="w-3 h-3" />
                      <span>{t('services.debt')}</span>
                    </div>
                  )}
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
                      {t('services.startRepair')}
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
                        {t('services.waitingForParts')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 bg-success/10 text-success border-success/30"
                        onClick={() => handleUpdateStatus(request, 'completed')}
                      >
                        {t('services.markCompleted')}
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
                      {t('services.resumeRepair')}
                    </Button>
                  )}
                  {request.status === 'completed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 bg-success/10 text-success border-success/30"
                      onClick={() => handleUpdateStatus(request, 'delivered')}
                    >
                      {t('services.markDelivered')}
                    </Button>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-border">
                <Button variant="outline" size="sm" className="flex-1 h-8 md:h-9 text-xs md:text-sm" onClick={() => openViewDialog(request)}>
                  <Eye className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1" />
                  {t('services.view')}
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
              {t('services.addNewRequest')}
            </DialogTitle>
            <DialogDescription>{t('services.addNewRequestDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('services.customerName')}</label>
                <Input
                  placeholder={t('services.customerNamePlaceholder')}
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('services.phoneNumber')}</label>
                <Input
                  placeholder={t('services.phonePlaceholder')}
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('services.deviceType')}</label>
                <select
                  className="w-full h-10 px-3 rounded-lg bg-muted border-0 text-foreground"
                  value={formData.deviceType}
                  onChange={(e) => setFormData({ ...formData, deviceType: e.target.value })}
                >
                  {deviceTypes.map(type => (
                    <option key={type.key} value={type.key}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('services.deviceModel')}</label>
                <Input
                  placeholder={t('services.deviceModelPlaceholder')}
                  value={formData.deviceModel}
                  onChange={(e) => setFormData({ ...formData, deviceModel: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('services.issue')} *</label>
              <Input
                placeholder={t('services.issuePlaceholder')}
                value={formData.issue}
                onChange={(e) => setFormData({ ...formData, issue: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('services.initialDiagnosis')}</label>
              <Input
                placeholder={t('services.initialDiagnosisPlaceholder')}
                value={formData.diagnosis}
                onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('services.expectedCostLabel')}</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.estimatedCost || ''}
                  onChange={(e) => setFormData({ ...formData, estimatedCost: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('services.expectedDelivery')}</label>
                <DatePicker
                  value={formData.estimatedDate}
                  onChange={(date) => setFormData({ ...formData, estimatedDate: date })}
                  placeholder={t('services.selectDeliveryDate')}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('services.responsibleTech')}</label>
              <Input
                placeholder={t('services.techNamePlaceholder')}
                value={formData.technician}
                onChange={(e) => setFormData({ ...formData, technician: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('services.notes')}</label>
              <Input
                placeholder={t('services.notesPlaceholder')}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowAddDialog(false)}>
                {t('services.cancel')}
              </Button>
              <Button className="flex-1" onClick={handleAddRequest}>
                <Save className="w-4 h-4 ml-2" />
                {t('services.addRequest')}
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
              {t('services.editRequest')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('services.customerName')}</label>
                <Input
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('services.phoneNumber')}</label>
                <Input
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('services.deviceType')}</label>
                <select
                  className="w-full h-10 px-3 rounded-lg bg-muted border-0 text-foreground"
                  value={formData.deviceType}
                  onChange={(e) => setFormData({ ...formData, deviceType: e.target.value })}
                >
                  {deviceTypes.map(type => (
                    <option key={type.key} value={type.key}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('services.deviceModel')}</label>
                <Input
                  value={formData.deviceModel}
                  onChange={(e) => setFormData({ ...formData, deviceModel: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('services.issue')} *</label>
              <Input
                value={formData.issue}
                onChange={(e) => setFormData({ ...formData, issue: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('services.diagnosis')}</label>
              <Input
                value={formData.diagnosis}
                onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('services.expectedCostLabel')}</label>
                <Input
                  type="number"
                  value={formData.estimatedCost || ''}
                  onChange={(e) => setFormData({ ...formData, estimatedCost: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('services.expectedDelivery')}</label>
                <DatePicker
                  value={formData.estimatedDate}
                  onChange={(date) => setFormData({ ...formData, estimatedDate: date })}
                  placeholder={t('services.selectDeliveryDate')}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('services.responsibleTech')}</label>
              <Input
                value={formData.technician}
                onChange={(e) => setFormData({ ...formData, technician: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('services.notes')}</label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowEditDialog(false)}>
                {t('services.cancel')}
              </Button>
              <Button className="flex-1" onClick={handleEditRequest}>
                <Save className="w-4 h-4 ml-2" />
                {t('services.saveChanges')}
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
                    {selectedRequest.completedAt ? t('services.completionDate') : t('services.expectedDelivery')}
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

      {/* Delivery Dialog */}
      <Dialog open={showDeliveryDialog} onOpenChange={setShowDeliveryDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-success" />
              تسليم طلب الصيانة
            </DialogTitle>
            <DialogDescription>
              أدخل تفاصيل التسليم والمبالغ المالية
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 py-4">
              {/* Customer & Device Info */}
              <div className="bg-muted rounded-lg p-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center">
                    <User className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{selectedRequest.customerName}</p>
                    <p className="text-sm text-muted-foreground">{selectedRequest.deviceType} - {selectedRequest.deviceModel}</p>
                  </div>
                </div>
              </div>

              {/* Financial Inputs */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">التكلفة علينا (القطع) ($)</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={deliveryData.partsCost || ''}
                    onChange={(e) => setDeliveryData({ ...deliveryData, partsCost: Number(e.target.value) })}
                    className="text-lg"
                  />
                  <p className="text-xs text-muted-foreground mt-1">تكلفة القطع والمواد المستخدمة</p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">المبلغ المقبوض من العميل ($)</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={deliveryData.amountReceived || ''}
                    onChange={(e) => setDeliveryData({ ...deliveryData, amountReceived: Number(e.target.value) })}
                    className="text-lg"
                  />
                </div>

                {/* Calculated Profit */}
                <div className="bg-success/10 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-foreground">الربح الصافي:</span>
                    <span className={cn(
                      "text-2xl font-bold",
                      (deliveryData.amountReceived - deliveryData.partsCost) >= 0
                        ? "text-success"
                        : "text-destructive"
                    )}>
                      ${deliveryData.amountReceived - deliveryData.partsCost}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">المبلغ المقبوض - التكلفة علينا</p>
                </div>

                {/* Payment Type */}
                <div>
                  <label className="text-sm font-medium mb-2 block">نوع الدفع</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setDeliveryData({ ...deliveryData, paymentType: 'cash' })}
                      className={cn(
                        "flex-1 py-3 px-4 rounded-lg border-2 transition-all flex items-center justify-center gap-2",
                        deliveryData.paymentType === 'cash'
                          ? "border-success bg-success/10 text-success"
                          : "border-border bg-muted text-muted-foreground hover:border-muted-foreground"
                      )}
                    >
                      <DollarSign className="w-5 h-5" />
                      <span className="font-medium">نقدي</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryData({ ...deliveryData, paymentType: 'debt' })}
                      className={cn(
                        "flex-1 py-3 px-4 rounded-lg border-2 transition-all flex items-center justify-center gap-2",
                        deliveryData.paymentType === 'debt'
                          ? "border-warning bg-warning/10 text-warning"
                          : "border-border bg-muted text-muted-foreground hover:border-muted-foreground"
                      )}
                    >
                      <Clock className="w-5 h-5" />
                      <span className="font-medium">دين</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowDeliveryDialog(false)}>
                  إلغاء
                </Button>
                <Button
                  className="flex-1 bg-success hover:bg-success/90"
                  onClick={handleDeliveryConfirm}
                  disabled={deliveryData.amountReceived <= 0}
                >
                  <CheckCircle className="w-4 h-4 ml-2" />
                  تأكيد التسليم
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
