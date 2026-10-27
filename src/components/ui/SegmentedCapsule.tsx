// أنماط الكبسولة الموحدة — مرجعها كبسولة شاشة المنتجات (النشطة / التصنيفات / الأرشيف)
export const capsuleOuter =
  'bg-muted/60 p-1 rounded-2xl grid grid-flow-col auto-cols-fr gap-1 w-full sm:w-fit sm:min-w-[24rem] border border-border/40 shadow-xs select-none';
export const capsuleOuterScroll =
  'bg-muted/60 p-1 rounded-2xl flex items-stretch gap-1 overflow-x-auto scrollbar-none w-full sm:w-fit border border-border/40 shadow-xs select-none h-auto';
export const capsuleItem =
  'rounded-xl p-1.5 sm:px-3.5 sm:py-2 min-h-11 text-[clamp(0.65rem,2.6vw,0.85rem)] font-bold min-w-0 leading-tight whitespace-normal text-center flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 transition-colors duration-200 select-none cursor-pointer';
export const capsuleActive = 'bg-gradient-primary text-primary-foreground shadow-xs';
export const capsuleIdle = 'text-muted-foreground hover:text-foreground hover:bg-card/60';
/** للاستخدام مع TabsTrigger (Radix) */
export const capsuleTrigger =
  capsuleItem +
  ' flex-1 shadow-none text-muted-foreground hover:text-foreground hover:bg-card/60 data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs';
export const capsuleIcon = 'w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0';
