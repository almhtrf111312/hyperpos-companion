import { toast } from 'sonner';

/**
 * Unified toast notification utility with consistent positioning and styling
 * Toasts appear at top-right to avoid overlapping with cart FAB
 * Duration reduced to 1.5s for faster workflow
 */
export const showToast = {
  success: (message: string, description?: string) => 
    toast.success(message, {
      position: 'top-right',
      duration: 1500,
      description,
    }),
    
  error: (message: string, options?: { description?: string; persistent?: boolean }) => 
    toast.error(message, {
      position: 'top-right',
      duration: options?.persistent ? Infinity : 2500,
      closeButton: options?.persistent,
      description: options?.description,
    }),
    
  warning: (message: string, description?: string) => 
    toast.warning(message, {
      position: 'top-right',
      duration: 2000,
      description,
    }),
    
  info: (message: string, description?: string) => 
    toast.info(message, {
      position: 'top-right',
      duration: 1500,
      description,
    }),
};
