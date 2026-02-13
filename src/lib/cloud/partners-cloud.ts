// Cloud Partners Store - Supabase-backed partners management
import { 
  fetchFromSupabase, 
  insertToSupabase, 
  updateInSupabase, 
  deleteFromSupabase,
  getCurrentUserId 
} from '../supabase-store';
import { emitEvent, EVENTS } from '../events';

export interface CategoryShare {
  categoryId: string;
  categoryName: string;
  percentage: number;
  enabled: boolean;
}

export interface Withdrawal {
  id: string;
  amount: number;
  type: 'profit' | 'capital';
  date: string;
  notes?: string;
}

export interface CapitalTransaction {
  id: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
  date: string;
  notes?: string;
}

export interface PendingProfitDetail {
  invoiceId: string;
  amount: number;
  customerName: string;
  createdAt: string;
}

export interface ProfitRecord {
  id: string;
  invoiceId: string;
  amount: number;
  category: string;
  isDebt: boolean;
  createdAt: string;
}

export interface ExpenseRecord {
  expenseId: string;
  type: string;
  amount: number;
  date: string;
  notes?: string;
  createdAt: string;
}

export interface CloudPartner {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  initial_capital: number;
  current_capital: number;
  share_percentage: number;
  expense_share_percentage: number | null;
  access_all: boolean;
  category_shares: CategoryShare[];
  total_profit_earned: number;
  total_withdrawn: number;
  current_balance: number;
  pending_profit: number;
  confirmed_profit: number;
  pending_profit_details: PendingProfitDetail[];
  profit_history: ProfitRecord[];
  expense_history: ExpenseRecord[];
  capital_history: CapitalTransaction[];
  withdrawal_history: Withdrawal[];
  joined_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Partner {
  id: string;
  name: string;
  phone: string;
  email?: string;
  sharePercentage: number;
  expenseSharePercentage?: number;
  categoryShares: CategoryShare[];
  accessAll: boolean;
  sharesExpenses: boolean;
  initialCapital: number;
  currentCapital: number;
  capitalWithdrawals: Withdrawal[];
  capitalHistory: CapitalTransaction[];
  confirmedProfit: number;
  pendingProfit: number;
  pendingProfitDetails: PendingProfitDetail[];
  currentBalance: number;
  totalWithdrawn: number;
  totalExpensesPaid: number;
  totalProfitEarned: number;
  profitHistory: ProfitRecord[];
  withdrawalHistory: Withdrawal[];
  expenseHistory: ExpenseRecord[];
  joinedDate: string;
}

// Transform cloud to legacy
function toPartner(cloud: CloudPartner): Partner {
  return {
    id: cloud.id,
    name: cloud.name,
    phone: cloud.phone || '',
    email: cloud.email || undefined,
    sharePercentage: Number(cloud.share_percentage) || 0,
    expenseSharePercentage: cloud.expense_share_percentage ? Number(cloud.expense_share_percentage) : undefined,
    categoryShares: cloud.category_shares || [],
    accessAll: cloud.access_all,
    sharesExpenses: true,
    initialCapital: Number(cloud.initial_capital) || 0,
    currentCapital: Number(cloud.current_capital) || 0,
    capitalWithdrawals: cloud.withdrawal_history?.filter(w => w.type === 'capital') || [],
    capitalHistory: cloud.capital_history || [],
    confirmedProfit: Number(cloud.confirmed_profit) || 0,
    pendingProfit: Number(cloud.pending_profit) || 0,
    pendingProfitDetails: cloud.pending_profit_details || [],
    currentBalance: Number(cloud.current_balance) || 0,
    totalWithdrawn: Number(cloud.total_withdrawn) || 0,
    totalExpensesPaid: 0,
    totalProfitEarned: Number(cloud.total_profit_earned) || 0,
    profitHistory: cloud.profit_history || [],
    withdrawalHistory: cloud.withdrawal_history || [],
    expenseHistory: cloud.expense_history || [],
    joinedDate: cloud.joined_date || cloud.created_at,
  };
}

// Transform legacy to cloud updates
function toCloudPartner(partner: Partial<Partner>): Record<string, unknown> {
  const cloud: Record<string, unknown> = {};
  
  if (partner.name !== undefined) cloud.name = partner.name;
  if (partner.phone !== undefined) cloud.phone = partner.phone || null;
  if (partner.email !== undefined) cloud.email = partner.email || null;
  if (partner.sharePercentage !== undefined) cloud.share_percentage = partner.sharePercentage;
  if (partner.expenseSharePercentage !== undefined) cloud.expense_share_percentage = partner.expenseSharePercentage;
  if (partner.categoryShares !== undefined) cloud.category_shares = partner.categoryShares;
  if (partner.accessAll !== undefined) cloud.access_all = partner.accessAll;
  if (partner.initialCapital !== undefined) cloud.initial_capital = partner.initialCapital;
  if (partner.currentCapital !== undefined) cloud.current_capital = partner.currentCapital;
  if (partner.confirmedProfit !== undefined) cloud.confirmed_profit = partner.confirmedProfit;
  if (partner.pendingProfit !== undefined) cloud.pending_profit = partner.pendingProfit;
  if (partner.pendingProfitDetails !== undefined) cloud.pending_profit_details = partner.pendingProfitDetails;
  if (partner.currentBalance !== undefined) cloud.current_balance = partner.currentBalance;
  if (partner.totalWithdrawn !== undefined) cloud.total_withdrawn = partner.totalWithdrawn;
  if (partner.totalProfitEarned !== undefined) cloud.total_profit_earned = partner.totalProfitEarned;
  if (partner.profitHistory !== undefined) cloud.profit_history = partner.profitHistory;
  if (partner.withdrawalHistory !== undefined) cloud.withdrawal_history = partner.withdrawalHistory;
  if (partner.expenseHistory !== undefined) cloud.expense_history = partner.expenseHistory;
  if (partner.capitalHistory !== undefined) cloud.capital_history = partner.capitalHistory;
  if (partner.joinedDate !== undefined) cloud.joined_date = partner.joinedDate;
  
  return cloud;
}

// Local storage cache helpers
const LOCAL_CACHE_KEY = 'hyperpos_partners_cache';

const savePartnersLocally = (partners: Partner[]) => {
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(partners));
  } catch { /* ignore */ }
};

const loadPartnersLocally = (): Partner[] | null => {
  try {
    const data = localStorage.getItem(LOCAL_CACHE_KEY);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
};

// Cache
let partnersCache: Partner[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30000;

// Load partners
export const loadPartnersCloud = async (): Promise<Partner[]> => {
  const userId = getCurrentUserId();
  if (!userId) return [];

  if (partnersCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return partnersCache;
  }

  // Offline: return local cache
  if (!navigator.onLine) {
    const local = loadPartnersLocally();
    if (local) {
      partnersCache = local;
      cacheTimestamp = Date.now();
      return local;
    }
    return [];
  }

  const cloudPartners = await fetchFromSupabase<CloudPartner>('partners', {
    column: 'created_at',
    ascending: true,
  });

  partnersCache = cloudPartners.map(toPartner);
  cacheTimestamp = Date.now();
  savePartnersLocally(partnersCache);
  
  return partnersCache;
};

export const invalidatePartnersCache = () => {
  partnersCache = null;
  cacheTimestamp = 0;
};

// Save partners (full update)
export const savePartnersCloud = async (partners: Partner[]): Promise<void> => {
  for (const partner of partners) {
    await updateInSupabase('partners', partner.id, toCloudPartner(partner));
  }
  invalidatePartnersCache();
  emitEvent(EVENTS.PARTNERS_UPDATED, null);
};

// Get partner by ID
export const getPartnerByIdCloud = async (id: string): Promise<Partner | null> => {
  const partners = await loadPartnersCloud();
  return partners.find(p => p.id === id) || null;
};

// Add partner
export const addPartnerCloud = async (
  partnerData: Omit<Partner, 'id' | 'capitalWithdrawals' | 'capitalHistory' | 'pendingProfitDetails' | 'profitHistory' | 'withdrawalHistory' | 'expenseHistory'>
): Promise<Partner | null> => {
  const inserted = await insertToSupabase<CloudPartner>('partners', {
    name: partnerData.name,
    phone: partnerData.phone || null,
    email: partnerData.email || null,
    share_percentage: partnerData.sharePercentage,
    expense_share_percentage: partnerData.expenseSharePercentage || null,
    category_shares: partnerData.categoryShares || [],
    access_all: partnerData.accessAll,
    initial_capital: partnerData.initialCapital || 0,
    current_capital: partnerData.currentCapital || 0,
    confirmed_profit: partnerData.confirmedProfit || 0,
    pending_profit: partnerData.pendingProfit || 0,
    pending_profit_details: [],
    current_balance: partnerData.currentBalance || 0,
    total_withdrawn: partnerData.totalWithdrawn || 0,
    total_profit_earned: partnerData.totalProfitEarned || 0,
    profit_history: [],
    expense_history: [],
    capital_history: [],
    withdrawal_history: [],
    joined_date: partnerData.joinedDate || new Date().toISOString().split('T')[0],
  });
  
  if (inserted) {
    invalidatePartnersCache();
    emitEvent(EVENTS.PARTNERS_UPDATED, null);
    return toPartner(inserted);
  }
  
  return null;
};

// Update partner
export const updatePartnerCloud = async (
  id: string, 
  updates: Partial<Partner>
): Promise<boolean> => {
  const success = await updateInSupabase('partners', id, toCloudPartner(updates));
  
  if (success) {
    invalidatePartnersCache();
    emitEvent(EVENTS.PARTNERS_UPDATED, null);
  }
  
  return success;
};

// Delete partner
export const deletePartnerCloud = async (id: string): Promise<boolean> => {
  const success = await deleteFromSupabase('partners', id);
  
  if (success) {
    invalidatePartnersCache();
    emitEvent(EVENTS.PARTNERS_UPDATED, null);
  }
  
  return success;
};

// Add capital
export const addCapitalCloud = async (
  partnerId: string,
  amount: number,
  notes?: string
): Promise<boolean> => {
  const partner = await getPartnerByIdCloud(partnerId);
  if (!partner || amount <= 0) return false;
  
  const roundedAmount = Math.round(amount * 100) / 100;
  
  const transaction: CapitalTransaction = {
    id: Date.now().toString(),
    amount: roundedAmount,
    type: 'deposit',
    date: new Date().toISOString(),
    notes: notes || 'إضافة رأس مال',
  };
  
  return updatePartnerCloud(partnerId, {
    initialCapital: partner.initialCapital + roundedAmount,
    currentCapital: partner.currentCapital + roundedAmount,
    capitalHistory: [...partner.capitalHistory, transaction],
  });
};

/**
 * ✅ دالة محسّنة: إضافة رأس مال مع تحديث الصندوق تلقائياً
 * هذه الدالة تضيف رأس المال للشريك + ترفع رصيد الصندوق (تعمل بدون وردية)
 */
export const addCapitalWithCashboxCloud = async (
  partnerId: string,
  partnerName: string,
  amount: number,
  notes?: string
): Promise<boolean> => {
  try {
    // 1. تحديث سجل الشريك في Cloud
    const partnerSuccess = await addCapitalCloud(partnerId, amount, notes);
    
    if (partnerSuccess) {
      // 2. تحديث capital-store المحلي للتوافق
      const { loadCapitalState, saveCapitalState } = await import('../capital-store');
      const state = loadCapitalState();
      const roundedAmount = Math.round(amount * 100) / 100;
      
      state.currentCapital = state.currentCapital + roundedAmount;
      state.totalInvestments = state.totalInvestments + roundedAmount;
      state.lastUpdated = new Date().toISOString();
      
      // إضافة للتاريخ
      state.transactions.unshift({
        id: Date.now().toString(),
        type: 'partner_investment',
        amount: roundedAmount,
        partnerId,
        partnerName,
        description: notes || `استثمار من ${partnerName}`,
        previousBalance: state.currentCapital - roundedAmount,
        newBalance: state.currentCapital,
        createdAt: new Date().toISOString(),
        createdBy: 'system',
      });
      
      saveCapitalState(state);
      
      // 3. تحديث رصيد الصندوق (يعمل بدون وردية)
      const { updateCashboxBalance } = await import('../cashbox-store');
      updateCashboxBalance(roundedAmount, 'deposit');
      
      emitEvent(EVENTS.CAPITAL_UPDATED, state);
    }
    
    return partnerSuccess;
  } catch (error) {
    console.error('Error adding capital with cashbox:', error);
    return false;
  }
};

// Withdraw profit
export const withdrawProfitCloud = async (
  partnerId: string,
  amount: number,
  notes?: string,
  allowNegative: boolean = false
): Promise<boolean> => {
  const partner = await getPartnerByIdCloud(partnerId);
  if (!partner || amount <= 0) return false;
  
  if (!allowNegative && amount > partner.currentBalance) {
    return false;
  }
  
  const withdrawal: Withdrawal = {
    id: Date.now().toString(),
    amount,
    type: 'profit',
    date: new Date().toISOString(),
    notes,
  };
  
  return updatePartnerCloud(partnerId, {
    currentBalance: partner.currentBalance - amount,
    totalWithdrawn: partner.totalWithdrawn + amount,
    withdrawalHistory: [...partner.withdrawalHistory, withdrawal],
  });
};

// Get partners stats
export const getPartnersStatsCloud = async () => {
  const partners = await loadPartnersCloud();
  return {
    count: partners.length,
    totalCapital: partners.reduce((sum, p) => sum + p.currentCapital, 0),
    totalBalance: partners.reduce((sum, p) => sum + p.currentBalance, 0),
    totalWithdrawn: partners.reduce((sum, p) => sum + p.totalWithdrawn, 0),
    totalProfitEarned: partners.reduce((sum, p) => sum + p.totalProfitEarned, 0),
  };
};

// ✅ توزيع الأرباح على الشركاء - النسخة السحابية
export interface CategoryProfit {
  category: string;
  profit: number;
}

export interface ProfitDistribution {
  partnerId: string;
  partnerName: string;
  amount: number;
  percentage: number;
}

export const distributeDetailedProfitCloud = async (
  profits: CategoryProfit[],
  invoiceId: string,
  customerName: string,
  isDebt: boolean
): Promise<ProfitDistribution[]> => {
  const partners = await loadPartnersCloud();
  const allDistributions: ProfitDistribution[] = [];
  
  if (partners.length === 0 || profits.length === 0) return allDistributions;
  
  const updatedPartners: Map<string, Partner> = new Map();
  
  // Process each category profit
  profits.forEach(({ category, profit }) => {
    if (profit <= 0) return;
    
    let remainingProfit = profit;
    
    // ======= المرحلة 1: الشركاء المتخصصون في الصنف =======
    const specializedPartners = partners.filter(p => 
      !p.accessAll && p.categoryShares.some(cs => cs.enabled && cs.categoryName === category)
    );
    
    specializedPartners.forEach(partner => {
      const categoryShare = partner.categoryShares.find(
        cs => cs.enabled && cs.categoryName === category
      );
      
      if (categoryShare && categoryShare.percentage > 0) {
        const partnerShare = (profit * categoryShare.percentage) / 100;
        remainingProfit -= partnerShare;
        
        allDistributions.push({
          partnerId: partner.id,
          partnerName: partner.name,
          amount: partnerShare,
          percentage: categoryShare.percentage,
        });
        
        // Get or create updated partner
        let updatedPartner = updatedPartners.get(partner.id) || { ...partner };
        
        const profitRecord: ProfitRecord = {
          id: Date.now().toString() + partner.id + category,
          invoiceId,
          amount: partnerShare,
          category,
          isDebt,
          createdAt: new Date().toISOString(),
        };
        
        if (isDebt) {
          updatedPartner.pendingProfit += partnerShare;
          updatedPartner.pendingProfitDetails = [
            ...updatedPartner.pendingProfitDetails,
            { invoiceId, amount: partnerShare, customerName, createdAt: new Date().toISOString() }
          ];
        } else {
          updatedPartner.confirmedProfit += partnerShare;
          updatedPartner.currentBalance += partnerShare;
          updatedPartner.totalProfitEarned += partnerShare;
        }
        
        updatedPartner.profitHistory = [...updatedPartner.profitHistory, profitRecord];
        updatedPartners.set(partner.id, updatedPartner);
      }
    });
    
    // ======= المرحلة 2: الشركاء الكاملون =======
    if (remainingProfit > 0) {
      const fullPartners = partners.filter(p => p.accessAll);
      const totalFullShare = fullPartners.reduce((sum, p) => sum + p.sharePercentage, 0);
      
      fullPartners.forEach(partner => {
        if (partner.sharePercentage > 0 && totalFullShare > 0) {
          const partnerRatio = partner.sharePercentage / totalFullShare;
          const partnerShare = remainingProfit * partnerRatio;
          
          allDistributions.push({
            partnerId: partner.id,
            partnerName: partner.name,
            amount: partnerShare,
            percentage: partner.sharePercentage,
          });
          
          let updatedPartner = updatedPartners.get(partner.id) || { ...partner };
          
          const profitRecord: ProfitRecord = {
            id: Date.now().toString() + partner.id + category,
            invoiceId,
            amount: partnerShare,
            category,
            isDebt,
            createdAt: new Date().toISOString(),
          };
          
          if (isDebt) {
            updatedPartner.pendingProfit += partnerShare;
            updatedPartner.pendingProfitDetails = [
              ...updatedPartner.pendingProfitDetails,
              { invoiceId, amount: partnerShare, customerName, createdAt: new Date().toISOString() }
            ];
          } else {
            updatedPartner.confirmedProfit += partnerShare;
            updatedPartner.currentBalance += partnerShare;
            updatedPartner.totalProfitEarned += partnerShare;
          }
          
          updatedPartner.profitHistory = [...updatedPartner.profitHistory, profitRecord];
          updatedPartners.set(partner.id, updatedPartner);
        }
      });
    }
  });
  
  // ✅ حفظ التحديثات في السحابة
  await Promise.all(
    Array.from(updatedPartners.values()).map(p => updatePartnerCloud(p.id, {
      confirmedProfit: p.confirmedProfit,
      pendingProfit: p.pendingProfit,
      pendingProfitDetails: p.pendingProfitDetails,
      currentBalance: p.currentBalance,
      totalProfitEarned: p.totalProfitEarned,
      profitHistory: p.profitHistory,
    }))
  );
  
  return allDistributions;
};

// ✅ تأكيد الأرباح المعلقة عند سداد الدين - النسخة السحابية
export const confirmPendingProfitCloud = async (invoiceId: string, ratio: number = 1): Promise<void> => {
  if (!invoiceId || invoiceId.startsWith('CASH_')) return;
  
  const partners = await loadPartnersCloud();
  
  for (const partner of partners) {
    const pendingDetails = partner.pendingProfitDetails.filter(d => d.invoiceId === invoiceId);
    if (pendingDetails.length === 0) continue;
    
    let totalConfirmed = 0;
    const updatedDetails = partner.pendingProfitDetails.map(detail => {
      if (detail.invoiceId !== invoiceId) return detail;
      
      const amountToConfirm = Math.min(detail.amount, detail.amount * ratio);
      totalConfirmed += amountToConfirm;
      
      return { ...detail, amount: Math.max(0, detail.amount - amountToConfirm) };
    }).filter(d => d.amount > 0);
    
    if (totalConfirmed > 0) {
      await updatePartnerCloud(partner.id, {
        pendingProfit: Math.max(0, partner.pendingProfit - totalConfirmed),
        confirmedProfit: partner.confirmedProfit + totalConfirmed,
        currentBalance: partner.currentBalance + totalConfirmed,
        totalProfitEarned: partner.totalProfitEarned + totalConfirmed,
        pendingProfitDetails: updatedDetails,
      });
    }
  }
};
