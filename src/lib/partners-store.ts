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

export interface Partner {
  id: string;
  name: string;
  phone: string;
  email?: string;
  sharePercentage: number;
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
          totalExpensesPaid: p.totalExpensesPaid ?? 0,
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

// Distribute profit to partners - SEQUENTIAL distribution
export const distributeProfit = (
  profit: number,
  category: string,
  invoiceId: string,
  customerName: string,
  isDebt: boolean
): ProfitDistribution[] => {
  const partners = loadPartners();
  const distributions: ProfitDistribution[] = [];
  
  if (partners.length === 0 || profit <= 0) return distributions;
  
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
      
      distributions.push({
        partnerId: partner.id,
        partnerName: partner.name,
        amount: partnerShare,
        percentage: categoryShare.percentage,
      });
      
      // Update partner data
      const profitRecord: ProfitRecord = {
        id: Date.now().toString() + partner.id,
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
        
        distributions.push({
          partnerId: partner.id,
          partnerName: partner.name,
          amount: partnerShare,
          percentage: partner.sharePercentage,
        });
        
        // Update partner data
        const profitRecord: ProfitRecord = {
          id: Date.now().toString() + partner.id,
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
  
  savePartners(partners);
  return distributions;
};

// Confirm pending profit when debt is paid
export const confirmPendingProfit = (invoiceId: string, ratio: number = 1): void => {
  const partners = loadPartners();
  
  partners.forEach(partner => {
    const pendingDetails = partner.pendingProfitDetails.filter(
      pd => pd.invoiceId === invoiceId
    );
    
    pendingDetails.forEach(detail => {
      const amountToConfirm = detail.amount * ratio;
      
      // نقل من المعلق إلى المؤكد
      partner.pendingProfit -= amountToConfirm;
      partner.confirmedProfit += amountToConfirm;
      partner.currentBalance += amountToConfirm;
      partner.totalProfitEarned += amountToConfirm;
      
      // إذا تم السداد الكامل، حذف التفاصيل
      if (ratio >= 1) {
        partner.pendingProfitDetails = partner.pendingProfitDetails.filter(
          pd => pd.invoiceId !== invoiceId
        );
      } else {
        // تحديث المبلغ المتبقي
        detail.amount -= amountToConfirm;
      }
    });
  });
  
  savePartners(partners);
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

// Withdraw profit
export const withdrawProfit = (
  partnerId: string,
  amount: number,
  notes?: string
): boolean => {
  const partners = loadPartners();
  const partner = partners.find(p => p.id === partnerId);
  
  if (!partner || amount <= 0 || amount > partner.currentBalance) {
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

// Withdraw capital
export const withdrawCapital = (
  partnerId: string,
  amount: number,
  notes?: string
): boolean => {
  const partners = loadPartners();
  const partner = partners.find(p => p.id === partnerId);
  
  if (!partner || amount <= 0 || amount > partner.currentCapital) {
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
