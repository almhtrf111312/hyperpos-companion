import { useState } from 'react';
import { Plus, Edit2, Trash2, GripVertical, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  CustomField,
  CustomFieldType,
  loadCustomFields,
  addCustomField,
  updateCustomField,
  deleteCustomField,
  saveCustomFields,
} from '@/lib/custom-fields-config';

interface CustomFieldsManagerProps {
  onFieldsChange?: () => void;
}

const fieldTypeLabels: Record<CustomFieldType, string> = {
  text: 'نص',
  number: 'رقم',
  select: 'قائمة اختيار',
};

export function CustomFieldsManager({ onFieldsChange }: CustomFieldsManagerProps) {
  const [fields, setFields] = useState<CustomField[]>(() => loadCustomFields());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedField, setSelectedField] = useState<CustomField | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'text' as CustomFieldType,
    placeholder: '',
    required: false,
    enabled: true,
    options: '',
    showInTable: false,
    showInDetails: true,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'text',
      placeholder: '',
      required: false,
      enabled: true,
      options: '',
      showInTable: false,
      showInDetails: true,
    });
  };

  const handleAddField = () => {
    if (!formData.name.trim()) {
      toast.error('يرجى إدخال اسم الحقل');
      return;
    }

    const options = formData.type === 'select' && formData.options
      ? formData.options.split(',').map(o => o.trim()).filter(Boolean)
      : undefined;

    addCustomField({
      name: formData.name.trim(),
      type: formData.type,
      placeholder: formData.placeholder.trim() || undefined,
      required: formData.required,
      enabled: formData.enabled,
      options,
      showInTable: formData.showInTable,
      showInDetails: formData.showInDetails,
    });

    setFields(loadCustomFields());
    setShowAddDialog(false);
    resetForm();
    onFieldsChange?.();
    toast.success('تم إضافة الحقل بنجاح');
  };

  const handleEditField = () => {
    if (!selectedField || !formData.name.trim()) {
      toast.error('يرجى إدخال اسم الحقل');
      return;
    }

    const options = formData.type === 'select' && formData.options
      ? formData.options.split(',').map(o => o.trim()).filter(Boolean)
      : undefined;

    updateCustomField(selectedField.id, {
      name: formData.name.trim(),
      type: formData.type,
      placeholder: formData.placeholder.trim() || undefined,
      required: formData.required,
      enabled: formData.enabled,
      options,
      showInTable: formData.showInTable,
      showInDetails: formData.showInDetails,
    });

    setFields(loadCustomFields());
    setShowEditDialog(false);
    setSelectedField(null);
    resetForm();
    onFieldsChange?.();
    toast.success('تم تعديل الحقل بنجاح');
  };

  const handleDeleteField = () => {
    if (!selectedField) return;
    
    deleteCustomField(selectedField.id);
    setFields(loadCustomFields());
    setShowDeleteDialog(false);
    setSelectedField(null);
    onFieldsChange?.();
    toast.success('تم حذف الحقل بنجاح');
  };

  const handleToggleEnabled = (field: CustomField) => {
    updateCustomField(field.id, { enabled: !field.enabled });
    setFields(loadCustomFields());
    onFieldsChange?.();
  };

  const openEditDialog = (field: CustomField) => {
    setSelectedField(field);
    setFormData({
      name: field.name,
      type: field.type,
      placeholder: field.placeholder || '',
      required: field.required,
      enabled: field.enabled,
      options: field.options?.join(', ') || '',
      showInTable: field.showInTable,
      showInDetails: field.showInDetails,
    });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (field: CustomField) => {
    setSelectedField(field);
    setShowDeleteDialog(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-foreground">الحقول المخصصة</h4>
          <p className="text-sm text-muted-foreground">
            أضف حقولاً إضافية خاصة بمنتجاتك
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 ml-2" />
          إضافة حقل
        </Button>
      </div>

      {fields.length === 0 ? (
        <div className="text-center py-8 bg-muted/30 rounded-lg border border-dashed border-border">
          <p className="text-muted-foreground text-sm">
            لم تقم بإضافة أي حقول مخصصة بعد
          </p>
          <Button 
            variant="link" 
            className="mt-2"
            onClick={() => setShowAddDialog(true)}
          >
            أضف أول حقل
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map((field) => (
            <div
              key={field.id}
              className="flex items-center justify-between p-3 bg-card rounded-lg border border-border/50"
            >
              <div className="flex items-center gap-3">
                <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                <div>
                  <div className="font-medium text-foreground flex items-center gap-2">
                    {field.name}
                    <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {fieldTypeLabels[field.type]}
                    </span>
                    {field.required && (
                      <span className="text-xs px-2 py-0.5 rounded bg-destructive/10 text-destructive">
                        مطلوب
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex gap-2 mt-0.5">
                    {field.showInTable && <span>• الجدول</span>}
                    {field.showInDetails && <span>• التفاصيل</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleEnabled(field)}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  title={field.enabled ? 'تعطيل' : 'تفعيل'}
                >
                  {field.enabled ? (
                    <ToggleRight className="w-5 h-5 text-success" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>
                <button
                  onClick={() => openEditDialog(field)}
                  className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openDeleteDialog(field)}
                  className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Field Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة حقل جديد</DialogTitle>
            <DialogDescription>أنشئ حقلاً مخصصاً لمنتجاتك</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">اسم الحقل *</label>
              <Input
                placeholder="مثال: الماركة"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">نوع الحقل</label>
              <select
                className="w-full h-10 px-3 rounded-md bg-muted border-0 text-foreground"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as CustomFieldType })}
              >
                <option value="text">نص</option>
                <option value="number">رقم</option>
                <option value="select">قائمة اختيار</option>
              </select>
            </div>
            {formData.type === 'select' && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">الخيارات (مفصولة بفاصلة)</label>
                <Input
                  placeholder="مثال: أحمر, أزرق, أخضر"
                  value={formData.options}
                  onChange={(e) => setFormData({ ...formData, options: e.target.value })}
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-1.5 block">نص توضيحي (اختياري)</label>
              <Input
                placeholder="مثال: أدخل اسم الماركة"
                value={formData.placeholder}
                onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">حقل مطلوب</span>
              <Switch
                checked={formData.required}
                onCheckedChange={(checked) => setFormData({ ...formData, required: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">إظهار في جدول المنتجات</span>
              <Switch
                checked={formData.showInTable}
                onCheckedChange={(checked) => setFormData({ ...formData, showInTable: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">إظهار في تفاصيل المنتج</span>
              <Switch
                checked={formData.showInDetails}
                onCheckedChange={(checked) => setFormData({ ...formData, showInDetails: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>
              إلغاء
            </Button>
            <Button onClick={handleAddField}>
              إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Field Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل الحقل</DialogTitle>
            <DialogDescription>عدّل إعدادات الحقل المخصص</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">اسم الحقل *</label>
              <Input
                placeholder="مثال: الماركة"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">نوع الحقل</label>
              <select
                className="w-full h-10 px-3 rounded-md bg-muted border-0 text-foreground"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as CustomFieldType })}
              >
                <option value="text">نص</option>
                <option value="number">رقم</option>
                <option value="select">قائمة اختيار</option>
              </select>
            </div>
            {formData.type === 'select' && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">الخيارات (مفصولة بفاصلة)</label>
                <Input
                  placeholder="مثال: أحمر, أزرق, أخضر"
                  value={formData.options}
                  onChange={(e) => setFormData({ ...formData, options: e.target.value })}
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-1.5 block">نص توضيحي (اختياري)</label>
              <Input
                placeholder="مثال: أدخل اسم الماركة"
                value={formData.placeholder}
                onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">حقل مطلوب</span>
              <Switch
                checked={formData.required}
                onCheckedChange={(checked) => setFormData({ ...formData, required: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">إظهار في جدول المنتجات</span>
              <Switch
                checked={formData.showInTable}
                onCheckedChange={(checked) => setFormData({ ...formData, showInTable: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">إظهار في تفاصيل المنتج</span>
              <Switch
                checked={formData.showInDetails}
                onCheckedChange={(checked) => setFormData({ ...formData, showInDetails: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditDialog(false); setSelectedField(null); resetForm(); }}>
              إلغاء
            </Button>
            <Button onClick={handleEditField}>
              حفظ التغييرات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الحقل</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف حقل "{selectedField?.name}"؟ سيتم حذف هذا الحقل من جميع المنتجات.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteField} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
