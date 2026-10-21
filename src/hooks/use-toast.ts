import * as React from "react";
import { showSmartToast, hideSmartToast, hideSmartToastById } from "@/hooks/use-smart-toast";
import { getSavedToastDuration } from "@/lib/toast-config";

export interface ToastOptions {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive";
  duration?: number;
  [key: string]: any;
}

/**
 * Standardized Flow POS Pro useToast hook
 * Routes legacy and component useToast calls to the in-app unified SmartToastCard.
 */
export function toast(options: ToastOptions | string, extra?: any) {
  if (typeof options === "string") {
    const desc = typeof extra === "object" && extra?.description ? extra.description : options;
    showSmartToast({
      type: "success",
      title: options,
      description: desc,
      duration: typeof extra === "object" && extra?.duration ? extra.duration : getSavedToastDuration(),
    });
    return String(Date.now());
  }

  const { title, description, variant, duration, ...rest } = options;
  const isDestructive = variant === "destructive";

  const effectiveTitle = title || (isDestructive ? "خطأ" : "إشعار");
  const effectiveDesc = description || effectiveTitle;

  showSmartToast({
    type: isDestructive ? "error" : "success",
    title: effectiveTitle,
    description: effectiveDesc,
    duration: duration ?? (isDestructive ? 6000 : getSavedToastDuration()),
    ...rest,
  });

  return String(Date.now());
}

export function useToast() {
  return {
    toast,
    dismiss: (toastId?: string) => {
      if (toastId) {
        hideSmartToastById(toastId);
      } else {
        hideSmartToast();
      }
    },
    toasts: [],
  };
}
