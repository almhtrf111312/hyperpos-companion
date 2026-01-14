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

// Distribute profit to partners
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
  
  partners.forEach(partner => {
    let percentage = 0;
    
    if (partner.accessAll) {
      // شريك عام - استخدم النسبة الرئيسية
      percentage = partner.sharePercentage;
    } else {
      // شريك متخصص - ابحث عن النسبة للفئة المحددة
      const categoryShare = partner.categoryShares.find(
        cs => cs.enabled && cs.categoryName === category
      );
      if (categoryShare) {
        percentage = categoryShare.percentage;
      }
    }
    
    if (percentage > 0) {
      const partnerShare = (profit * percentage) / 100;
      remainingProfit -= partnerShare;
      
      distributions.push({
        partnerId: partner.id,
        partnerName: partner.name,
        amount: partnerShare,
        percentage,
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
        // الأرباح من فواتير الدين تضاف كأرباح معلقة
        partner.pendingProfit += partnerShare;
        partner.pendingProfitDetails.push({
          invoiceId,
          amount: partnerShare,
          customerName,
          createdAt: new Date().toISOString(),
        });
      } else {
        // الأرباح النقدية تضاف مباشرة
        partner.confirmedProfit += partnerShare;
        partner.currentBalance += partnerShare;
        partner.totalProfitEarned += partnerShare;
      }
      
      partner.profitHistory.push(profitRecord);
    }
  });
  
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
  
  savePartners(partners);
  return true;
};

// Get partners statistics
export const getPartnersStats = () => {
  const partners = loadPartners();
  
  return {
    totalPartners: partners.length,
    totalShare: partners.reduce((sum, p) => sum + p.sharePercentage, 0),
    totalCapital: partners.reduce((sum, p) => sum + p.currentCapital, 0),
    totalBalance: partners.reduce((sum, p) => sum + p.currentBalance, 0),
    totalConfirmedProfit: partners.reduce((sum, p) => sum + p.confirmedProfit, 0),
    totalPendingProfit: partners.reduce((sum, p) => sum + p.pendingProfit, 0),
    totalWithdrawn: partners.reduce((sum, p) => sum + p.totalWithdrawn, 0),
  };
};

// Add partner
export const addPartner = (partnerData: Omit<Partner, 'id' | 'joinedDate' | 'profitHistory' | 'withdrawalHistory' | 'capitalWithdrawals' | 'pendingProfitDetails'>): Partner => {
  const partners = loadPartners();
  
  const newPartner: Partner = {
    ...partnerData,
    id: Date.now().toString(),
    joinedDate: new Date().toISOString().split('T')[0],
    profitHistory: [],
    withdrawalHistory: [],
    capitalWithdrawals: [],
    pendingProfitDetails: [],
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
