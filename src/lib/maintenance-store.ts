// Maintenance services store

const MAINTENANCE_STORAGE_KEY = 'hyperpos_maintenance_v1';

export interface MaintenanceService {
  id: string;
  customerName: string;
  customerPhone?: string;
  description: string;
  servicePrice: number;  // Price charged to customer
  partsCost: number;     // Our cost for parts
  profit: number;        // Calculated: servicePrice - partsCost
  paymentType: 'cash' | 'debt';
  createdAt: string;
  status: 'pending' | 'completed';
}

export const loadMaintenanceServices = (): MaintenanceService[] => {
  try {
    const stored = localStorage.getItem(MAINTENANCE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return [];
};

export const saveMaintenanceServices = (services: MaintenanceService[]) => {
  try {
    localStorage.setItem(MAINTENANCE_STORAGE_KEY, JSON.stringify(services));
  } catch {
    // ignore
  }
};

export const addMaintenanceService = (service: Omit<MaintenanceService, 'id' | 'profit' | 'createdAt'>): MaintenanceService => {
  const services = loadMaintenanceServices();
  const newService: MaintenanceService = {
    ...service,
    id: Date.now().toString(),
    profit: service.servicePrice - service.partsCost,
    createdAt: new Date().toISOString(),
  };
  services.push(newService);
  saveMaintenanceServices(services);
  return newService;
};

export const getMaintenanceStats = () => {
  const services = loadMaintenanceServices();
  return {
    total: services.length,
    totalRevenue: services.reduce((sum, s) => sum + s.servicePrice, 0),
    totalCost: services.reduce((sum, s) => sum + s.partsCost, 0),
    totalProfit: services.reduce((sum, s) => sum + s.profit, 0),
    pending: services.filter(s => s.status === 'pending').length,
    completed: services.filter(s => s.status === 'completed').length,
  };
};
