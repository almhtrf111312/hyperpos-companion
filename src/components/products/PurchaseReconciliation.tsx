 import { Button } from '@/components/ui/button';
 import { useLanguage } from '@/hooks/use-language';
 import { 
   Check, 
   X, 
   AlertTriangle, 
   ArrowRight,
   Package,
   Hash,
   DollarSign,
   CheckCircle2
 } from 'lucide-react';
 import { PurchaseInvoice, PurchaseInvoiceItem } from '@/lib/cloud/purchase-invoices-cloud';
 import { cn } from '@/lib/utils';
 
 interface PurchaseReconciliationProps {
   invoice: PurchaseInvoice;
   items: PurchaseInvoiceItem[];
   onBack: () => void;
   onFinalize: () => void;
   loading: boolean;
 }
 
 export function PurchaseReconciliation({ 
   invoice, 
   items, 
   onBack, 
   onFinalize, 
   loading 
 }: PurchaseReconciliationProps) {
   const { t } = useLanguage();
 
   const itemsMatch = invoice.actual_items_count === invoice.expected_items_count;
   const quantityMatch = invoice.actual_total_quantity === invoice.expected_total_quantity;
   const totalMatch = Math.abs(invoice.actual_grand_total - invoice.expected_grand_total) < 0.01;
   const allMatch = itemsMatch && quantityMatch && totalMatch;
 
   const itemsDiff = invoice.actual_items_count - invoice.expected_items_count;
   const quantityDiff = invoice.actual_total_quantity - invoice.expected_total_quantity;
   const totalDiff = invoice.actual_grand_total - invoice.expected_grand_total;
 
   return (
     <div className="space-y-6">
       {/* Status Banner */}
       <div className={cn(
         "p-4 rounded-lg flex items-center gap-3",
         allMatch ? "bg-success/20 border border-success/30" : "bg-warning/20 border border-warning/30"
       )}>
         {allMatch ? (
           <CheckCircle2 className="w-6 h-6 text-success" />
         ) : (
           <AlertTriangle className="w-6 h-6 text-warning" />
         )}
         <div>
           <h3 className="font-medium">
             {allMatch ? t('purchaseInvoice.reconciled') : t('purchaseInvoice.discrepancyFound')}
           </h3>
           <p className="text-sm text-muted-foreground">
             {allMatch 
               ? t('purchaseInvoice.reconciledDesc') 
               : t('purchaseInvoice.discrepancyDesc')}
           </p>
         </div>
       </div>
 
       {/* Comparison Table */}
       <div className="border rounded-lg overflow-hidden">
         <table className="w-full">
           <thead className="bg-muted">
             <tr>
               <th className="p-3 text-right">{t('purchaseInvoice.field')}</th>
               <th className="p-3 text-center">{t('purchaseInvoice.expected')}</th>
               <th className="p-3 text-center">{t('purchaseInvoice.actual')}</th>
               <th className="p-3 text-center">{t('purchaseInvoice.difference')}</th>
               <th className="p-3 text-center">{t('purchaseInvoice.status')}</th>
             </tr>
           </thead>
           <tbody>
             {/* Items Count */}
             <tr className="border-t">
               <td className="p-3 flex items-center gap-2">
                 <Package className="w-4 h-4 text-muted-foreground" />
                 {t('purchaseInvoice.itemsCount')}
               </td>
               <td className="p-3 text-center font-mono">{invoice.expected_items_count}</td>
               <td className="p-3 text-center font-mono">{invoice.actual_items_count}</td>
               <td className={cn(
                 "p-3 text-center font-mono",
                 itemsDiff === 0 ? "" : itemsDiff > 0 ? "text-success" : "text-destructive"
               )}>
                 {itemsDiff === 0 ? "-" : itemsDiff > 0 ? `+${itemsDiff}` : itemsDiff}
               </td>
               <td className="p-3 text-center">
                 {itemsMatch ? (
                   <Check className="w-5 h-5 text-success mx-auto" />
                 ) : (
                   <X className="w-5 h-5 text-destructive mx-auto" />
                 )}
               </td>
             </tr>
 
             {/* Total Quantity */}
             <tr className="border-t">
               <td className="p-3 flex items-center gap-2">
                 <Hash className="w-4 h-4 text-muted-foreground" />
                 {t('purchaseInvoice.totalQuantity')}
               </td>
               <td className="p-3 text-center font-mono">{invoice.expected_total_quantity}</td>
               <td className="p-3 text-center font-mono">{invoice.actual_total_quantity}</td>
               <td className={cn(
                 "p-3 text-center font-mono",
                 quantityDiff === 0 ? "" : quantityDiff > 0 ? "text-success" : "text-destructive"
               )}>
                 {quantityDiff === 0 ? "-" : quantityDiff > 0 ? `+${quantityDiff}` : quantityDiff}
               </td>
               <td className="p-3 text-center">
                 {quantityMatch ? (
                   <Check className="w-5 h-5 text-success mx-auto" />
                 ) : (
                   <X className="w-5 h-5 text-destructive mx-auto" />
                 )}
               </td>
             </tr>
 
             {/* Grand Total */}
             <tr className="border-t bg-muted/50">
               <td className="p-3 flex items-center gap-2 font-medium">
                 <DollarSign className="w-4 h-4 text-muted-foreground" />
                 {t('purchaseInvoice.grandTotal')}
               </td>
               <td className="p-3 text-center font-mono font-medium">
                 ${invoice.expected_grand_total.toFixed(2)}
               </td>
               <td className="p-3 text-center font-mono font-medium">
                 ${invoice.actual_grand_total.toFixed(2)}
               </td>
               <td className={cn(
                 "p-3 text-center font-mono font-medium",
                 Math.abs(totalDiff) < 0.01 ? "" : totalDiff > 0 ? "text-success" : "text-destructive"
               )}>
                 {Math.abs(totalDiff) < 0.01 ? "-" : totalDiff > 0 ? `+$${totalDiff.toFixed(2)}` : `-$${Math.abs(totalDiff).toFixed(2)}`}
               </td>
               <td className="p-3 text-center">
                 {totalMatch ? (
                   <Check className="w-5 h-5 text-success mx-auto" />
                 ) : (
                   <X className="w-5 h-5 text-destructive mx-auto" />
                 )}
               </td>
             </tr>
           </tbody>
         </table>
       </div>
 
       {/* Items Summary */}
       <div className="border rounded-lg p-4">
         <h3 className="font-medium mb-3">{t('purchaseInvoice.itemsSummary')}</h3>
         <div className="max-h-40 overflow-y-auto space-y-1">
           {items.map((item, index) => (
             <div key={item.id} className="flex items-center justify-between text-sm py-1">
               <span className="flex items-center gap-2">
                 <span className="text-muted-foreground">{index + 1}.</span>
                 {item.product_name}
               </span>
               <span className="text-muted-foreground">
                 {item.quantity} × ${item.cost_price.toFixed(2)} = ${item.total_cost.toFixed(2)}
               </span>
             </div>
           ))}
         </div>
       </div>
 
       {/* Actions */}
       <div className="flex justify-between pt-4 border-t">
         <Button variant="outline" onClick={onBack} disabled={loading}>
           <ArrowRight className="w-4 h-4 ml-2" />
           {t('purchaseInvoice.backToItems')}
         </Button>
         <Button 
           onClick={onFinalize} 
           disabled={loading}
           className={allMatch ? "bg-success hover:bg-success/90" : ""}
         >
           {loading ? t('common.loading') : t('purchaseInvoice.finalizeInvoice')}
           <Check className="w-4 h-4 mr-2" />
         </Button>
       </div>
     </div>
   );
 }