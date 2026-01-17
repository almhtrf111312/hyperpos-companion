import { emitEvent, EVENTS } from './events';

const PARTNERS_STORAGE_KEY = 'hyperpos_partners_v1';

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

export interface Partner {
  id: string;
  name: string;
  phone: string;
  email?: string;
  sharePercentage: number;
  expenseSharePercentage?: number; // نسبة المشاركة في المصاريف (اختياري)
  categoryShares: CategoryShare[];
  accessAll: boolean;
  sharesExpenses: boolean;
  
  // رأس المال
  initialCapital: number;
  currentCapital: number;
  capitalWithdrawals: Withdrawal[];
  capitalHistory: CapitalTransaction[];
  
  // الأرباح
  confirmedProfit: number;
  pendingProfit: number;
  pendingProfitDetails: PendingProfitDetail[];
  
  // الأرصدة
  currentBalance: number;
  totalWithdrawn: number;
  totalExpensesPaid: number;
  totalProfitEarned: number;
  
  // السجلات
  profitHistory: ProfitRecord[];
  withdrawalHistory: Withdrawal[];
  expenseHistory: ExpenseRecord[]; // سجل المصاريف
  joinedDate: string;
}

export interface ProfitDistribution {
  partnerId: string;
  partnerName: string;
  amount: number;
  percentage: number;
}

// Load partners from localStorage
export const loadPartners = (): Partner[] => {
  try {
    const stored = localStorage.getItem(PARTNERS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Migrate old partner data structure
        return parsed.map(p => ({
          ...p,
          initialCapital: p.initialCapital ?? 0,
          currentCapital: p.currentCapital ?? 0,
          capitalWithdrawals: p.capitalWithdrawals ?? [],
          capitalHistory: p.capitalHistory ?? [],
          confirmedProfit: p.confirmedProfit ?? p.totalProfitEarned ?? 0,
          pendingProfit: p.pendingProfit ?? 0,
          pendingProfitDetails: p.pendingProfitDetails ?? [],
          profitHistory: p.profitHistory ?? [],
          withdrawalHistory: p.withdrawalHistory ?? [],
          expenseHistory: p.expenseHistory ?? [],
          totalExpensesPaid: p.totalExpensesPaid ?? 0,
          expenseSharePercentage: p.expenseSharePercentage,
        }));
      }
    }
  } catch {
    // ignore
  }
  return [];
};

// Save partners to localStorage
export const savePartners = (partners: Partner[]) => {
  try {
    localStorage.setItem(PARTNERS_STORAGE_KEY, JSON.stringify(partners));
    emitEvent(EVENTS.PARTNERS_UPDATED, partners);
  } catch {
    // ignore
  }
};

// Get partner by ID
export const getPartnerById = (id: string): Partner | null => {
  const partners = loadPartners();
  return partners.find(p => p.id === id) || null;
};

// Interface for category profits
export interface CategoryProfit {
  category: string;
  profit: number;
}

// Distribute profit to partners - SEQUENTIAL distribution (kept for backwards compatibility)
export const distributeProfit = (
  profit: number,
  category: string,
  invoiceId: string,
  customerName: string,
  isDebt: boolean
): ProfitDistribution[] => {
  // Delegate to the new function with a single category
  return distributeDetailedProfit(
    [{ category, profit }],
    invoiceId,
    customerName,
    isDebt
  );
};

// NEW: Distribute detailed profit - processes all categories in a single transaction
// This avoids Race Conditions by loading/saving partners only once
export const distributeDetailedProfit = (
  profits: CategoryProfit[],
  invoiceId: string,
  customerName: string,
  isDebt: boolean
): ProfitDistribution[] => {
  const partners = loadPartners();
  const allDistributions: ProfitDistribution[] = [];
  
  if (partners.length === 0 || profits.length === 0) return allDistributions;
  
  // Process each category profit
  profits.forEach(({ category, profit }) => {
    if (profit <= 0) return;
    
    let remainingProfit = profit;
    
    // ======= المرحلة 1: الشركاء المتخصصون في الصنف =======
    // يأخذون نسبتهم من الربح الأصلي أولاً
    const specializedPartners = partners.filter(p => 
      !p.accessAll && p.categoryShares.some(cs => cs.enabled && cs.categoryName === category)
    );
    
    specializedPartners.forEach(partner => {
      const categoryShare = partner.categoryShares.find(
        cs => cs.enabled && cs.categoryName === category
      );
      
      if (categoryShare && categoryShare.percentage > 0) {
        // يأخذ نسبته من الربح الأصلي
        const partnerShare = (profit * categoryShare.percentage) / 100;
        remainingProfit -= partnerShare;
        
        allDistributions.push({
          partnerId: partner.id,
          partnerName: partner.name,
          amount: partnerShare,
          percentage: categoryShare.percentage,
        });
        
        // Update partner data
        const profitRecord: ProfitRecord = {
          id: Date.now().toString() + partner.id + category,
          invoiceId,
          amount: partnerShare,
          category,
          isDebt,
          createdAt: new Date().toISOString(),
        };
        
        if (isDebt) {
          partner.pendingProfit += partnerShare;
          partner.pendingProfitDetails.push({
            invoiceId,
            amount: partnerShare,
            customerName,
            createdAt: new Date().toISOString(),
          });
        } else {
          partner.confirmedProfit += partnerShare;
          partner.currentBalance += partnerShare;
          partner.totalProfitEarned += partnerShare;
        }
        
        partner.profitHistory.push(profitRecord);
      }
    });
    
    // ======= المرحلة 2: الشركاء الكاملون =======
    // يأخذون نسبتهم من الربح المتبقي بعد الشركاء المتخصصين
    if (remainingProfit > 0) {
      const fullPartners = partners.filter(p => p.accessAll);
      
      // حساب إجمالي نسب الشركاء الكاملين
      const totalFullShare = fullPartners.reduce((sum, p) => sum + p.sharePercentage, 0);
      
      fullPartners.forEach(partner => {
        if (partner.sharePercentage > 0 && totalFullShare > 0) {
          // نسبة هذا الشريك من إجمالي نسب الشركاء الكاملين
          const partnerRatio = partner.sharePercentage / totalFullShare;
          // يأخذ نسبته من المتبقي
          const partnerShare = remainingProfit * partnerRatio;
          
          allDistributions.push({
            partnerId: partner.id,
            partnerName: partner.name,
            amount: partnerShare,
            percentage: partner.sharePercentage,
          });
          
          // Update partner data
          const profitRecord: ProfitRecord = {
            id: Date.now().toString() + partner.id + category,
            invoiceId,
            amount: partnerShare,
            category,
            isDebt,
            createdAt: new Date().toISOString(),
          };
          
          if (isDebt) {
            partner.pendingProfit += partnerShare;
            partner.pendingProfitDetails.push({
              invoiceId,
              amount: partnerShare,
              customerName,
              createdAt: new Date().toISOString(),
            });
          } else {
            partner.confirmedProfit += partnerShare;
            partner.currentBalance += partnerShare;
            partner.totalProfitEarned += partnerShare;
          }
          
          partner.profitHistory.push(profitRecord);
        }
      });
    }
  });
  
  // حفظ مرة واحدة فقط في النهاية - تجنب Race Condition
  savePartners(partners);
  
  return allDistributions;
};

// Confirm pending profit when debt is paid
// يتعامل مع السداد الجزئي بدقة ويدعم الديون النقدية
export const confirmPendingProfit = (invoiceId: string, ratio: number = 1): void => {
  // تجاهل الديون النقدية التي لا تملك أرباح شركاء مرتبطة
  if (!invoiceId || invoiceId.startsWith('CASH_')) {
    return;
  }
  
  const partners = loadPartners();
  let modified = false;
  
  partners.forEach(partner => {
    const pendingDetails = partner.pendingProfitDetails.filter(
      pd => pd.invoiceId === invoiceId
    );
    
    if (pendingDetails.length === 0) return;
    
    pendingDetails.forEach(detail => {
      // حساب المبلغ للتأكيد بناءً على النسبة المدفوعة
      const amountToConfirm = Math.min(detail.amount, detail.amount * ratio);
      
      if (amountToConfirm <= 0) return;
      
      // نقل من المعلق إلى المؤكد
      partner.pendingProfit = Math.max(0, partner.pendingProfit - amountToConfirm);
      partner.confirmedProfit += amountToConfirm;
      partner.currentBalance += amountToConfirm;
      partner.totalProfitEarned += amountToConfirm;
      
      // تحديث المبلغ المتبقي في التفاصيل
      detail.amount = Math.max(0, detail.amount - amountToConfirm);
      
      modified = true;
    });
    
    // حذف التفاصيل التي تم تأكيدها بالكامل (المبلغ = 0)
    partner.pendingProfitDetails = partner.pendingProfitDetails.filter(
      pd => pd.amount > 0
    );
  });
  
  if (modified) {
    savePartners(partners);
  }
};

// Add capital to partner
export const addCapital = (
  partnerId: string,
  amount: number,
  notes?: string
): boolean => {
  const partners = loadPartners();
  const partner = partners.find(p => p.id === partnerId);
  
  if (!partner || amount <= 0) {
    return false;
  }
  
  const transaction: CapitalTransaction = {
    id: Date.now().toString(),
    amount,
    type: 'deposit',
    date: new Date().toISOString(),
    notes,
  };
  
  partner.initialCapital += amount;
  partner.currentCapital += amount;
  
  if (!partner.capitalHistory) {
    partner.capitalHistory = [];
  }
  partner.capitalHistory.push(transaction);
  
  savePartners(partners);
  return true;
};

// Withdraw profit - prevents negative balance unless explicitly allowed
export const withdrawProfit = (
  partnerId: string,
  amount: number,
  notes?: string,
  allowNegative: boolean = false
): boolean => {
  const partners = loadPartners();
  const partner = partners.find(p => p.id === partnerId);
  
  if (!partner || amount <= 0) {
    return false;
  }
  
  // Prevent negative balance unless explicitly allowed
  if (!allowNegative && amount > partner.currentBalance) {
    console.warn('Withdraw denied: would result in negative balance', {
      partnerId,
      requested: amount,
      available: partner.currentBalance
    });
    return false;
  }
  
  const withdrawal: Withdrawal = {
    id: Date.now().toString(),
    amount,
    type: 'profit',
    date: new Date().toISOString(),
    notes,
  };
  
  partner.currentBalance -= amount;
  partner.totalWithdrawn += amount;
  partner.withdrawalHistory.push(withdrawal);
  
  savePartners(partners);
  return true;
};

// Withdraw capital - prevents negative balance unless explicitly allowed
export const withdrawCapital = (
  partnerId: string,
  amount: number,
  notes?: string,
  allowNegative: boolean = false
): boolean => {
  const partners = loadPartners();
  const partner = partners.find(p => p.id === partnerId);
  
  if (!partner || amount <= 0) {
    return false;
  }
  
  // Prevent negative balance unless explicitly allowed
  if (!allowNegative && amount > partner.currentCapital) {
    console.warn('Capital withdraw denied: would result in negative balance', {
      partnerId,
      requested: amount,
      available: partner.currentCapital
    });
    return false;
  }
  
  const withdrawal: Withdrawal = {
    id: Date.now().toString(),
    amount,
    type: 'capital',
    date: new Date().toISOString(),
    notes,
  };
  
  partner.currentCapital -= amount;
  partner.capitalWithdrawals.push(withdrawal);
  
  // Also add to capital history
  if (!partner.capitalHistory) {
    partner.capitalHistory = [];
  }
  partner.capitalHistory.push({
    id: Date.now().toString(),
    amount,
    type: 'withdrawal',
    date: new Date().toISOString(),
    notes,
  });
  
  savePartners(partners);
  return true;
};

// Smart withdraw - profit first, then capital
export const smartWithdraw = (
  partnerId: string,
  amount: number,
  notes?: string
): { success: boolean; fromProfit: number; fromCapital: number } => {
  const partners = loadPartners();
  const partner = partners.find(p => p.id === partnerId);
  
  if (!partner || amount <= 0) {
    return { success: false, fromProfit: 0, fromCapital: 0 };
  }
  
  const totalAvailable = partner.currentBalance + partner.currentCapital;
  if (amount > totalAvailable) {
    return { success: false, fromProfit: 0, fromCapital: 0 };
  }
  
  let remaining = amount;
  let fromProfit = 0;
  let fromCapital = 0;
  
  // First, withdraw from profit
  if (partner.currentBalance > 0) {
    fromProfit = Math.min(remaining, partner.currentBalance);
    partner.currentBalance -= fromProfit;
    partner.totalWithdrawn += fromProfit;
    remaining -= fromProfit;
    
    if (fromProfit > 0) {
      partner.withdrawalHistory.push({
        id: Date.now().toString(),
        amount: fromProfit,
        type: 'profit',
        date: new Date().toISOString(),
        notes: notes ? `${notes} (من الأرباح)` : 'سحب من الأرباح',
      });
    }
  }
  
  // Then, withdraw from capital if needed
  if (remaining > 0 && partner.currentCapital >= remaining) {
    fromCapital = remaining;
    partner.currentCapital -= fromCapital;
    
    partner.capitalWithdrawals.push({
      id: Date.now().toString(),
      amount: fromCapital,
      type: 'capital',
      date: new Date().toISOString(),
      notes: notes ? `${notes} (من رأس المال)` : 'سحب من رأس المال',
    });
    
    if (!partner.capitalHistory) {
      partner.capitalHistory = [];
    }
    partner.capitalHistory.push({
      id: Date.now().toString(),
      amount: fromCapital,
      type: 'withdrawal',
      date: new Date().toISOString(),
      notes: notes ? `${notes} (من رأس المال)` : 'سحب من رأس المال',
    });
  }
  
  savePartners(partners);
  return { success: true, fromProfit, fromCapital };
};

// Get partners statistics
export const getPartnersStats = () => {
  const partners = loadPartners();
  
  // Calculate full partners share (only those with accessAll)
  const fullPartners = partners.filter(p => p.accessAll);
  const specializedPartners = partners.filter(p => !p.accessAll);
  
  return {
    totalPartners: partners.length,
    fullPartnersCount: fullPartners.length,
    specializedPartnersCount: specializedPartners.length,
    fullPartnersShare: fullPartners.reduce((sum, p) => sum + p.sharePercentage, 0),
    totalCapital: partners.reduce((sum, p) => sum + p.currentCapital, 0),
    totalInitialCapital: partners.reduce((sum, p) => sum + p.initialCapital, 0),
    totalBalance: partners.reduce((sum, p) => sum + p.currentBalance, 0),
    totalConfirmedProfit: partners.reduce((sum, p) => sum + p.confirmedProfit, 0),
    totalPendingProfit: partners.reduce((sum, p) => sum + p.pendingProfit, 0),
    totalWithdrawn: partners.reduce((sum, p) => sum + p.totalWithdrawn, 0),
    totalExpensesPaid: partners.reduce((sum, p) => sum + (p.totalExpensesPaid || 0), 0),
  };
};

// Add partner
export const addPartner = (partnerData: Omit<Partner, 'id' | 'joinedDate' | 'profitHistory' | 'withdrawalHistory' | 'capitalWithdrawals' | 'pendingProfitDetails' | 'capitalHistory'>): Partner => {
  const partners = loadPartners();
  
  const newPartner: Partner = {
    ...partnerData,
    id: Date.now().toString(),
    joinedDate: new Date().toISOString().split('T')[0],
    profitHistory: [],
    withdrawalHistory: [],
    capitalWithdrawals: [],
    pendingProfitDetails: [],
    capitalHistory: [],
  };
  
  partners.push(newPartner);
  savePartners(partners);
  
  return newPartner;
};

// Update partner
export const updatePartner = (id: string, updates: Partial<Partner>): boolean => {
  const partners = loadPartners();
  const index = partners.findIndex(p => p.id === id);
  
  if (index === -1) return false;
  
  partners[index] = { ...partners[index], ...updates };
  savePartners(partners);
  
  return true;
};

// Delete partner
export const deletePartner = (id: string): boolean => {
  const partners = loadPartners();
  const filtered = partners.filter(p => p.id !== id);
  
  if (filtered.length === partners.length) return false;
  
  savePartners(filtered);
  return true;
};

// Revert profit distribution when invoice is deleted
export const revertProfitDistribution = (invoiceId: string): void => {
  const partners = loadPartners();
  
  partners.forEach(partner => {
    // Remove from pending profits
    const pendingDetails = partner.pendingProfitDetails.filter(
      pd => pd.invoiceId === invoiceId
    );
    
    pendingDetails.forEach(detail => {
      partner.pendingProfit -= detail.amount;
    });
    
    partner.pendingProfitDetails = partner.pendingProfitDetails.filter(
      pd => pd.invoiceId !== invoiceId
    );
    
    // Remove from profit history and revert confirmed profits
    const profitRecords = partner.profitHistory.filter(
      pr => pr.invoiceId === invoiceId
    );
    
    profitRecords.forEach(record => {
      if (!record.isDebt) {
        partner.confirmedProfit -= record.amount;
        partner.currentBalance -= record.amount;
        partner.totalProfitEarned -= record.amount;
      }
    });
    
    partner.profitHistory = partner.profitHistory.filter(
      pr => pr.invoiceId !== invoiceId
    );
  });
  
  savePartners(partners);
};
