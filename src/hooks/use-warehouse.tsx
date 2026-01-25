import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { useAuth } from './use-auth';
import { useUserRole } from './use-user-role';
import { 
  Warehouse, 
  loadWarehousesCloud, 
  getMainWarehouseCloud,
  getWarehouseForCashierCloud,
  addWarehouseCloud,
  invalidateWarehousesCache
} from '@/lib/cloud/warehouses-cloud';
import { subscribeToEvent, EVENTS } from '@/lib/events';

interface WarehouseContextType {
  warehouses: Warehouse[];
  activeWarehouse: Warehouse | null;
  mainWarehouse: Warehouse | null;
  isLoading: boolean;
  setActiveWarehouse: (warehouse: Warehouse | null) => void;
  refreshWarehouses: () => Promise<void>;
  ensureMainWarehouse: () => Promise<Warehouse | null>;
}

const WarehouseContext = createContext<WarehouseContextType | undefined>(undefined);

export function WarehouseProvider({ children }: { children: ReactNode }) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [activeWarehouse, setActiveWarehouse] = useState<Warehouse | null>(null);
  const [mainWarehouse, setMainWarehouse] = useState<Warehouse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const { user } = useAuth();
  const { isCashier, isAdmin, isBoss } = useUserRole();

  const loadData = useCallback(async () => {
    if (!user) {
      setWarehouses([]);
      setActiveWarehouse(null);
      setMainWarehouse(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const allWarehouses = await loadWarehousesCloud();
      setWarehouses(allWarehouses);

      // Set main warehouse
      const main = await getMainWarehouseCloud();
      setMainWarehouse(main);

      // Set active warehouse based on role
      if (isCashier && user.id) {
        // Cashiers see their assigned warehouse
        const cashierWarehouse = await getWarehouseForCashierCloud(user.id);
        setActiveWarehouse(cashierWarehouse || main);
      } else {
        // Admins/Boss default to main warehouse
        setActiveWarehouse(main);
      }
    } catch (error) {
      console.error('[useWarehouse] Load error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, isCashier]);

  // Ensure main warehouse exists (create if not)
  const ensureMainWarehouse = useCallback(async (): Promise<Warehouse | null> => {
    if (mainWarehouse) return mainWarehouse;

    // Try to create main warehouse
    const newWarehouse = await addWarehouseCloud({
      name: 'المستودع الرئيسي',
      type: 'main',
      assigned_cashier_id: null,
      address: null,
      phone: null,
      is_default: true,
      is_active: true
    });

    if (newWarehouse) {
      invalidateWarehousesCache();
      await loadData();
      return newWarehouse;
    }

    return null;
  }, [mainWarehouse, loadData]);

  const refreshWarehouses = useCallback(async () => {
    invalidateWarehousesCache();
    await loadData();
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Subscribe to warehouse updates
  useEffect(() => {
    const unsubscribe = subscribeToEvent(EVENTS.WAREHOUSES_UPDATED, () => {
      loadData();
    });

    return () => unsubscribe();
  }, [loadData]);

  return (
    <WarehouseContext.Provider value={{
      warehouses,
      activeWarehouse,
      mainWarehouse,
      isLoading,
      setActiveWarehouse,
      refreshWarehouses,
      ensureMainWarehouse
    }}>
      {children}
    </WarehouseContext.Provider>
  );
}

export function useWarehouse() {
  const context = useContext(WarehouseContext);
  if (context === undefined) {
    throw new Error('useWarehouse must be used within a WarehouseProvider');
  }
  return context;
}
