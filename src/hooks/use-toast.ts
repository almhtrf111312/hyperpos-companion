import * as React from "react";
import { toast as sonnerToast } from "@/components/ui/sonner";

export interface ToastOptions {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive";
  duration?: number;
  [key: string]: any;
}

/**
 * Compatibility bridge redirecting legacy useToast calls to Sonner
 */
export function toast(options: ToastOptions | string, extra?: any) {
  if (typeof options === "string") {
    return sonnerToast(options, extra);
  }

  const { title, description, variant, duration, ...rest } = options;

  if (variant === "destructive") {
    return sonnerToast.error(title || description, {
      description: title ? description : undefined,
      duration: duration ?? Infinity,
      closeButton: true,
      ...rest,
    });
  }

  return sonnerToast.success(title || description, {
    description: title ? description : undefined,
    duration: duration ?? 2600,
    ...rest,
  });
}

// Attach all native Sonner methods to toast
Object.assign(toast, sonnerToast);

export function useToast() {
  return {
    toast,
    dismiss: (toastId?: string) => sonnerToast.dismiss(toastId),
    toasts: [],
  };
}
