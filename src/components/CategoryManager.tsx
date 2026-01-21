import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, X, Save, Tag, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
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
import { 
  loadCategoriesCloud, 
  addCategoryCloud,
  updateCategoryCloud,
  deleteCategoryCloud,
  Category 
} from '@/lib/cloud/categories-cloud';

interface CategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesChange?: () => void;
  usedCategories?: string[]; // Categories that are in use and cannot be deleted
}

export function CategoryManager({ 
  isOpen, 
  onClose, 
  onCategoriesChange,
  usedCategories = []
}: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const cats = await loadCategoriesCloud();
      setCategories(cats);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      toast.error('يرجى إدخال اسم التصنيف');
      return;
    }
    
    // Check for duplicate
    if (categories.some(c => c.name === name)) {
      toast.error('هذا التصنيف موجود بالفعل');
      return;
    }
    
    setIsSaving(true);
    const newCategory = await addCategoryCloud(name);
    setIsSaving(false);
    
    if (newCategory) {
      setNewCategoryName('');
      onCategoriesChange?.();
      toast.success('تم إضافة التصنيف بنجاح');
      loadData();
    } else {
      toast.error('فشل في إضافة التصنيف');
    }
  };

  const handleEditCategory = async () => {
    if (!editingCategory) return;
    
    const name = editName.trim();
    if (!name) {
      toast.error('يرجى إدخال اسم التصنيف');
      return;
    }
    
    // Check for duplicate (excluding current)
    if (categories.some(c => c.name === name && c.id !== editingCategory.id)) {
      toast.error('هذا التصنيف موجود بالفعل');
      return;
    }
    
    setIsSaving(true);
    const success = await updateCategoryCloud(editingCategory.id, name);
    setIsSaving(false);
    
    if (success) {
      setEditingCategory(null);
      setEditName('');
      onCategoriesChange?.();
      toast.success('تم تعديل التصنيف بنجاح');
      loadData();
    } else {
      toast.error('فشل في تعديل التصنيف');
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategory) return;
    
    setIsSaving(true);
    const success = await deleteCategoryCloud(deleteCategory.id);
    setIsSaving(false);
    
    if (success) {
      setDeleteCategory(null);
      onCategoriesChange?.();
      toast.success('تم حذف التصنيف بنجاح');
      loadData();
    } else {
      toast.error('فشل في حذف التصنيف');
    }
  };

  const startEdit = (category: Category) => {
    setEditingCategory(category);
    setEditName(category.name);
  };

  const isCategoryInUse = (categoryName: string) => {
    return usedCategories.includes(categoryName);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              إدارة التصنيفات
            </DialogTitle>
          </DialogHeader>

          {/* Add new category */}
          <div className="flex gap-2 p-2 bg-muted rounded-lg">
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="اسم التصنيف الجديد..."
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
              disabled={isSaving}
            />
            <Button onClick={handleAddCategory} size="icon" disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>

          {/* Categories list */}
          <div className="flex-1 overflow-y-auto space-y-2 py-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {categories.map((category) => (
                  <div 
                    key={category.id}
                    className="flex items-center justify-between p-3 bg-card border rounded-lg"
                  >
                    {editingCategory?.id === category.id ? (
                      <div className="flex gap-2 flex-1">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleEditCategory()}
                          disabled={isSaving}
                        />
                        <Button size="icon" variant="ghost" onClick={handleEditCategory} disabled={isSaving}>
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-green-600" />}
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditingCategory(null)} disabled={isSaving}>
                          <X className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{category.name}</span>
                          {isCategoryInUse(category.name) && (
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                              مستخدم
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => startEdit(category)}
                            className="h-8 w-8"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteCategory(category)}
                            className="h-8 w-8 text-red-600 hover:text-red-700"
                            disabled={isCategoryInUse(category.name)}
                            title={isCategoryInUse(category.name) ? 'لا يمكن حذف تصنيف مستخدم' : ''}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                
                {categories.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Tag className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>لا توجد تصنيفات</p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="pt-2 border-t">
            <Button variant="outline" onClick={onClose} className="w-full">
              إغلاق
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteCategory} onOpenChange={() => setDeleteCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف التصنيف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف التصنيف "{deleteCategory?.name}"؟
              <br />
              لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={isSaving}>إلغاء</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteCategory}
              className="bg-red-600 hover:bg-red-700"
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
