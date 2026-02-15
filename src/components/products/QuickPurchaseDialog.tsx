import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/hooks/use-language';
import { toast } from 'sonner';
import { ShoppingBag, Camera, Image as ImageIcon, WifiOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { uploadProductImage } from '@/lib/image-upload';
import { addToQueue } from '@/lib/sync-queue';
import { emitEvent, EVENTS } from '@/lib/events';

interface QuickPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function QuickPurchaseDialog({ open, onOpenChange, onSuccess }: QuickPurchaseDialogProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);

  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [costPrice, setCostPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (!open) {
      setProductName('');
      setQuantity('1');
      setCostPrice('');
      setImageUrl('');
    }
  }, [open]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const url = await uploadProductImage(base64);
        if (url) setImageUrl(url);
        setUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadingImage(false);
    }
  };

  const handleCameraCapture = async () => {
    try {
      const { Camera: CapCamera } = await import('@capacitor/camera');
      const photo = await (CapCamera as any).getPhoto({
        quality: 70,
        resultType: 'base64' as any,
        source: 'CAMERA' as any,
      });
      if (photo?.base64String) {
        setUploadingImage(true);
        const base64 = `data:image/jpeg;base64,${photo.base64String}`;
        const url = await uploadProductImage(base64);
        if (url) setImageUrl(url);
        setUploadingImage(false);
      }
    } catch {
      // Camera not available
    }
  };

  const handleSubmit = async () => {
    if (!productName || !costPrice) {
      toast.error(t('products.fillRequired'));
      return;
    }

    setLoading(true);
    const totalCost = parseFloat(costPrice) * parseInt(quantity || '1');
    const qtyNum = parseInt(quantity || '1');

    // If offline, queue the operation
    if (!navigator.onLine) {
      addToQueue('quick_purchase', {
        productName,
        quantity: qtyNum,
        costPrice: parseFloat(costPrice),
        totalCost,
        imageUrl: imageUrl || undefined,
      });
      toast.success(t('purchases.quickAdded') + ' (offline)', { icon: '📴' });
      emitEvent(EVENTS.PURCHASES_UPDATED);
      onSuccess?.();
      onOpenChange(false);
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const invoiceNumber = `QP-${Date.now()}`;

      // Create invoice
      const { data: invoice, error: invError } = await supabase
        .from('purchase_invoices')
        .insert({
          user_id: user.id,
          invoice_number: invoiceNumber,
          supplier_name: productName,
          invoice_date: new Date().toISOString().split('T')[0],
          expected_items_count: 1,
          expected_total_quantity: qtyNum,
          expected_grand_total: totalCost,
          actual_items_count: 1,
          actual_total_quantity: qtyNum,
          actual_grand_total: totalCost,
          status: 'finalized',
          image_url: imageUrl || null,
        })
        .select()
        .single();

      if (invError) throw invError;

      // Create item
      await supabase
        .from('purchase_invoice_items')
        .insert({
          invoice_id: invoice.id,
          product_name: productName,
          quantity: qtyNum,
          cost_price: parseFloat(costPrice),
          total_cost: totalCost,
        });

      toast.success(t('purchases.quickAdded'));
      emitEvent(EVENTS.PURCHASES_UPDATED);
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding quick purchase:', error);
      // Fallback to queue on network error
      addToQueue('quick_purchase', {
        productName,
        quantity: qtyNum,
        costPrice: parseFloat(costPrice),
        totalCost,
        imageUrl: imageUrl || undefined,
      });
      toast.success(t('purchases.quickAdded') + ' (queued)', { icon: '📴' });
      emitEvent(EVENTS.PURCHASES_UPDATED);
      onSuccess?.();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            {t('purchases.quickAdd')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm">{t('products.name')} *</Label>
            <Input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder={t('purchases.itemNamePlaceholder')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">{t('products.quantity')}</Label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t('products.costPrice')} *</Label>
              <Input
                type="number"
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Total */}
          {costPrice && quantity && (
            <div className="p-2 bg-muted rounded-lg text-center">
              <span className="text-sm text-muted-foreground">{t('common.total')}: </span>
              <span className="font-bold text-foreground">
                ${(parseFloat(costPrice || '0') * parseInt(quantity || '1')).toFixed(2)}
              </span>
            </div>
          )}

          {/* Image Upload */}
          <div className="space-y-1.5">
            <Label className="text-sm">{t('purchases.receiptPhoto')}</Label>
            {imageUrl ? (
              <div className="relative">
                <img src={imageUrl} alt="Receipt" className="w-full h-32 object-cover rounded-lg border" />
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute top-1 right-1 h-6 text-xs px-2"
                  onClick={() => setImageUrl('')}
                >
                  {t('common.delete')}
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleCameraCapture}
                  disabled={uploadingImage}
                >
                  <Camera className="w-4 h-4 ml-1" />
                  {t('purchases.camera')}
                </Button>
                <label className="flex-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={uploadingImage}
                    asChild
                  >
                    <span>
                      <ImageIcon className="w-4 h-4 ml-1" />
                      {t('purchases.gallery')}
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>
              </div>
            )}
            {uploadingImage && (
              <p className="text-xs text-muted-foreground text-center">{t('common.loading')}...</p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={loading || uploadingImage}>
              {loading ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
