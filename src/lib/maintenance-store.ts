import { emitEvent, EVENTS } from './events';

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
    emitEvent(EVENTS.MAINTENANCE_UPDATED, services);
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
    status: service.status || 'pending',
  };
  services.push(newService);
  saveMaintenanceServices(services);
  return newService;
};
