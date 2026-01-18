import { toast } from 'sonner';

/**
 * Unified toast notification utility with consistent positioning and styling
 * All toasts appear at bottom-center to avoid overlapping with action buttons
 */
export const showToast = {
  success: (message: string, description?: string) => 
    toast.success(message, {
      position: 'bottom-center',
      duration: 2000,
      description,
    }),
    
  error: (message: string, options?: { description?: string; persistent?: boolean }) => 
    toast.error(message, {
      position: 'bottom-center',
      duration: options?.persistent ? Infinity : 3000,
      closeButton: options?.persistent,
      description: options?.description,
    }),
    
  warning: (message: string, description?: string) => 
    toast.warning(message, {
      position: 'bottom-center',
      duration: 2500,
      description,
    }),
    
  info: (message: string, description?: string) => 
    toast.info(message, {
      position: 'bottom-center',
      duration: 2000,
      description,
    }),
};
