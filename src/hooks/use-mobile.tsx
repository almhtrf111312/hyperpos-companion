import * as React from "react";

export const MOBILE_BREAKPOINT = 768;
export const TABLET_BREAKPOINT = 1024;

export type DeviceType = "mobile" | "tablet" | "desktop";

/**
 * Returns true if viewport is < 768px (Mobile)
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

/**
 * Returns true if viewport is >= 768px and < 1024px (iPad / Tablet)
 */
export function useIsTablet(): boolean {
  const [isTablet, setIsTablet] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const w = window.innerWidth;
    return w >= MOBILE_BREAKPOINT && w < TABLET_BREAKPOINT;
  });

  React.useEffect(() => {
    const mql = window.matchMedia(
      `(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${TABLET_BREAKPOINT - 1}px)`
    );
    const onChange = () => {
      const w = window.innerWidth;
      setIsTablet(w >= MOBILE_BREAKPOINT && w < TABLET_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isTablet;
}

/**
 * Returns true if viewport is >= 1024px (PC / Desktop)
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= TABLET_BREAKPOINT;
  });

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${TABLET_BREAKPOINT}px)`);
    const onChange = () => {
      setIsDesktop(window.innerWidth >= TABLET_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}

/**
 * Returns active device type: 'mobile' | 'tablet' | 'desktop'
 */
export function useDeviceType(): DeviceType {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  if (isMobile) return "mobile";
  if (isTablet) return "tablet";
  return "desktop";
}

/**
 * Comprehensive responsive hook for components that need multi-device awareness
 */
export function useResponsive() {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isDesktop = !isMobile && !isTablet;
  const deviceType: DeviceType = isMobile ? "mobile" : isTablet ? "tablet" : "desktop";

  return {
    isMobile,
    isTablet,
    isDesktop,
    deviceType,
  };
}
