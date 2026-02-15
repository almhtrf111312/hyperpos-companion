import { supabase } from '@/integrations/supabase/client';
import { getCurrentUserId } from '../supabase-store';

export interface LibraryMember {
  id: string;
  name: string;
  phone: string;
  email: string;
  registrationDate: string;
  membershipStatus: 'active' | 'suspended';
  lateFees: number;
  notes: string;
  createdAt: string;
  // Computed
  activeLoans?: number;
}

export interface BookLoan {
  id: string;
  productId: string;
  memberId: string;
  loanDate: string;
  dueDate: string;
  returnDate: string | null;
  status: 'active' | 'returned' | 'overdue' | 'lost';
  lateFee: number;
  notes: string;
  createdAt: string;
  // Joined
  memberName?: string;
  bookName?: string;
}

// ========== Library Members ==========

export const loadMembersCloud = async (): Promise<LibraryMember[]> => {
  const userId = getCurrentUserId();
  if (!userId) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('library_members')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load members:', error);
    return [];
  }

  return (data || []).map((m: any) => ({
    id: m.id,
    name: m.name,
    phone: m.phone || '',
    email: m.email || '',
    registrationDate: m.registration_date || '',
    membershipStatus: m.membership_status || 'active',
    lateFees: m.late_fees || 0,
    notes: m.notes || '',
    createdAt: m.created_at,
  }));
};

export const addMemberCloud = async (member: Partial<LibraryMember>): Promise<LibraryMember | null> => {
  const userId = getCurrentUserId();
  if (!userId) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('library_members')
    .insert({
      user_id: userId,
      name: member.name,
      phone: member.phone || null,
      email: member.email || null,
      membership_status: member.membershipStatus || 'active',
      notes: member.notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to add member:', error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    phone: data.phone || '',
    email: data.email || '',
    registrationDate: data.registration_date || '',
    membershipStatus: data.membership_status,
    lateFees: data.late_fees || 0,
    notes: data.notes || '',
    createdAt: data.created_at,
  };
};

export const updateMemberCloud = async (id: string, updates: Partial<LibraryMember>): Promise<boolean> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.phone !== undefined) updateData.phone = updates.phone || null;
  if (updates.email !== undefined) updateData.email = updates.email || null;
  if (updates.membershipStatus !== undefined) updateData.membership_status = updates.membershipStatus;
  if (updates.lateFees !== undefined) updateData.late_fees = updates.lateFees;
  if (updates.notes !== undefined) updateData.notes = updates.notes || null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('library_members')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error('Failed to update member:', error);
    return false;
  }
  return true;
};

export const deleteMemberCloud = async (id: string): Promise<boolean> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('library_members')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Failed to delete member:', error);
    return false;
  }
  return true;
};

// ========== Book Loans ==========

export const loadLoansCloud = async (): Promise<BookLoan[]> => {
  const userId = getCurrentUserId();
  if (!userId) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('book_loans')
    .select('*, library_members(name), products(name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load loans:', error);
    return [];
  }

  return (data || []).map((l: any) => ({
    id: l.id,
    productId: l.product_id,
    memberId: l.member_id,
    loanDate: l.loan_date,
    dueDate: l.due_date,
    returnDate: l.return_date,
    status: l.status || 'active',
    lateFee: l.late_fee || 0,
    notes: l.notes || '',
    createdAt: l.created_at,
    memberName: l.library_members?.name || '',
    bookName: l.products?.name || '',
  }));
};

export const addLoanCloud = async (loan: {
  productId: string;
  memberId: string;
  dueDate: string;
  notes?: string;
}): Promise<BookLoan | null> => {
  const userId = getCurrentUserId();
  if (!userId) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('book_loans')
    .insert({
      user_id: userId,
      product_id: loan.productId,
      member_id: loan.memberId,
      due_date: loan.dueDate,
      notes: loan.notes || null,
    })
    .select('*, library_members(name), products(name)')
    .single();

  if (error) {
    console.error('Failed to add loan:', error);
    return null;
  }

  // Deduct 1 from product stock
  try {
    await supabase.rpc('deduct_product_quantity', {
      _product_id: loan.productId,
      _amount: 1,
    });
    console.log('[Library] Deducted 1 from product stock for loan');
  } catch (e) {
    console.error('[Library] Failed to deduct stock:', e);
  }

  return {
    id: data.id,
    productId: data.product_id,
    memberId: data.member_id,
    loanDate: data.loan_date,
    dueDate: data.due_date,
    returnDate: data.return_date,
    status: data.status,
    lateFee: data.late_fee || 0,
    notes: data.notes || '',
    createdAt: data.created_at,
    memberName: data.library_members?.name || '',
    bookName: data.products?.name || '',
  };
};

export const returnLoanCloud = async (id: string, lateFee: number = 0): Promise<boolean> => {
  // First get the loan to know the product_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: loanData } = await (supabase as any)
    .from('book_loans')
    .select('product_id')
    .eq('id', id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('book_loans')
    .update({
      status: 'returned',
      return_date: new Date().toISOString().split('T')[0],
      late_fee: lateFee,
    })
    .eq('id', id);

  if (error) {
    console.error('Failed to return loan:', error);
    return false;
  }

  // Add 1 back to product stock
  if (loanData?.product_id) {
    try {
      await supabase.rpc('add_product_quantity', {
        _product_id: loanData.product_id,
        _amount: 1,
      });
      console.log('[Library] Added 1 back to product stock on return');
    } catch (e) {
      console.error('[Library] Failed to add stock back:', e);
    }
  }

  return true;
};

export const markLoanLostCloud = async (id: string): Promise<boolean> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('book_loans')
    .update({ status: 'lost' })
    .eq('id', id);

  if (error) {
    console.error('Failed to mark loan as lost:', error);
    return false;
  }
  return true;
};

export const deleteLoanCloud = async (id: string): Promise<boolean> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('book_loans')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Failed to delete loan:', error);
    return false;
  }
  return true;
};
