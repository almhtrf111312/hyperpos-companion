import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { QueuedOperation } from '@/lib/sync-queue';

type LooseSupabase = SupabaseClient<any, 'public', any>;
const sb = supabase as unknown as LooseSupabase;

async function assertSuccess(request: PromiseLike<{ error: { message?: string } | null }>): Promise<boolean> {
  const { error } = await request;
  if (error) throw new Error(error.message || 'Cloud operation failed');
  return true;
}

export async function processGenericQueuedOperation(operation: QueuedOperation): Promise<boolean> {
  const data = operation.data;

  switch (operation.type) {
    case 'profit_record':
      return assertSuccess(sb.from('profit_records').insert(data));
    case 'profit_reverse':
      return assertSuccess(sb.from('profit_records').update({
        is_reversed: true,
        reversed_at: new Date().toISOString(),
      }).eq('invoice_id', String(data.invoiceId || '')).eq('is_reversed', false));
    case 'shift_open':
      return assertSuccess(sb.from('cash_shifts').insert(data));
    case 'shift_close': {
      const { shiftId, userId: _userId, uniqueKey: _uniqueKey, ...updates } = data;
      if (!shiftId) throw new Error('Missing shift id');
      return assertSuccess(sb.from('cash_shifts').update(updates).eq('id', String(shiftId)));
    }
    case 'shift_transaction':
      return assertSuccess(sb.from('shift_transactions').insert(data));
    case 'sale': {
      if (data._operation === 'product_add') {
        const product = data.product;
        if (!product || typeof product !== 'object') throw new Error('Invalid offline product');
        return assertSuccess(sb.from('products').insert(product));
      }
      if (data._operation === 'product_update') {
        if (!data.id || !data.updates || typeof data.updates !== 'object') throw new Error('Invalid product update');
        return assertSuccess(sb.from('products').update(data.updates).eq('id', String(data.id)));
      }
      throw new Error('Legacy sale queue item requires review and was not deleted');
    }
    default:
      throw new Error(`Unsupported sync operation: ${operation.type}`);
  }
}