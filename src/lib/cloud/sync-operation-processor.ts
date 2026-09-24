import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { QueuedOperation } from '@/lib/sync-queue';
import { filterTablePayload } from '@/lib/supabase-store';

type LooseSupabase = SupabaseClient<any, 'public', any>;
const sb = supabase as unknown as LooseSupabase;

async function assertSuccess(request: PromiseLike<{ error: { message?: string; details?: string; hint?: string; code?: string } | null }>): Promise<boolean> {
  const { error } = await request;
  if (error) {
    const code = error.code ? `[${error.code}] ` : '';
    const details = error.details ? ` (${error.details})` : '';
    const hint = error.hint ? ` [تلميح: ${error.hint}]` : '';
    throw new Error(`${code}${error.message || 'فشلت العملية السحابية'}${details}${hint}`.trim());
  }
  return true;
}

export async function processGenericQueuedOperation(operation: QueuedOperation): Promise<boolean> {
  const data = operation.data;

  switch (operation.type) {
    case 'profit_record': {
      const cleanData = filterTablePayload('profit_records', data);
      return assertSuccess(sb.from('profit_records').insert(cleanData));
    }
    case 'profit_reverse':
      return assertSuccess(sb.from('profit_records').update({
        is_reversed: true,
        reversed_at: new Date().toISOString(),
      }).eq('invoice_id', String(data.invoiceId || '')).eq('is_reversed', false));
    case 'shift_open': {
      const cleanData = filterTablePayload('cash_shifts', data);
      return assertSuccess(sb.from('cash_shifts').insert(cleanData));
    }
    case 'shift_close': {
      const { shiftId, userId: _userId, uniqueKey: _uniqueKey, ...updates } = data;
      if (!shiftId) throw new Error('Missing shift id');
      const cleanUpdates = filterTablePayload('cash_shifts', updates);
      return assertSuccess(sb.from('cash_shifts').update(cleanUpdates).eq('id', String(shiftId)));
    }
    case 'shift_transaction': {
      const cleanData = filterTablePayload('shift_transactions', data);
      return assertSuccess(sb.from('shift_transactions').insert(cleanData));
    }
    case 'expense': {
      const cleanData = filterTablePayload('expenses', data);
      return assertSuccess(sb.from('expenses').insert(cleanData));
    }
    case 'debt': {
      const cleanData = filterTablePayload('debts', data);
      return assertSuccess(sb.from('debts').insert(cleanData));
    }
    case 'customer_update': {
      const { id, ...updates } = data;
      if (!id) throw new Error('Missing customer id');
      const cleanUpdates = filterTablePayload('customers', updates);
      return assertSuccess(sb.from('customers').update(cleanUpdates).eq('id', String(id)));
    }
    case 'sale': {
      if (data._operation === 'product_add') {
        const product = data.product;
        if (!product || typeof product !== 'object') throw new Error('Invalid offline product');
        const cleanProduct = filterTablePayload('products', product as Record<string, unknown>);
        return assertSuccess(sb.from('products').insert(cleanProduct));
      }
      if (data._operation === 'product_update') {
        if (!data.id || !data.updates || typeof data.updates !== 'object') throw new Error('Invalid product update');
        const cleanUpdates = filterTablePayload('products', data.updates as Record<string, unknown>);
        return assertSuccess(sb.from('products').update(cleanUpdates).eq('id', String(data.id)));
      }
      throw new Error('Legacy sale queue item requires review and was not deleted');
    }
    default:
      throw new Error(`Unsupported sync operation: ${operation.type}`);
  }
}