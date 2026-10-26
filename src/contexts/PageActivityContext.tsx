import React, { createContext, useContext } from 'react';

export interface PageActivityContextValue {
  isActive: boolean;
  activePath: string;
}

const PageActivityContext = createContext<PageActivityContextValue>({
  isActive: true,
  activePath: '',
});

export function PageActivityProvider({
  isActive,
  activePath,
  children,
}: {
  isActive: boolean;
  activePath: string;
  children: React.ReactNode;
}) {
  return (
    <PageActivityContext.Provider value={{ isActive, activePath }}>
      {children}
    </PageActivityContext.Provider>
  );
}

/**
 * usePageActivity
 * يُرجع حالة الصفحة الحالية: هل هي نشطة معروضة للمستخدم ({ isActive: true })
 * أم مخفية في الذاكرة بالخلفية ({ isActive: false }).
 */
export function usePageActivity(): PageActivityContextValue {
  return useContext(PageActivityContext);
}

export function usePageActivityDetails(): PageActivityContextValue {
  return useContext(PageActivityContext);
}
