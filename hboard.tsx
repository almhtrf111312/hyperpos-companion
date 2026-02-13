[33mcommit 9afc5f6d25ef83b26d2921e7b94eb73c07a7f60f[m[33m ([m[1;36mHEAD[m[33m -> [m[1;32mmain[m[33m, [m[1;31morigin/main[m[33m, [m[1;31morigin/HEAD[m[33m)[m
Author: Manager <manager@hyperpos.com>
Date:   Fri Feb 13 03:57:16 2026 +0300

    feat: quick actions 3x3 exact layout

[1mdiff --git a/src/components/dashboard/QuickActions.tsx b/src/components/dashboard/QuickActions.tsx[m
[1mindex 2ccd72d..be1a1b3 100644[m
[1m--- a/src/components/dashboard/QuickActions.tsx[m
[1m+++ b/src/components/dashboard/QuickActions.tsx[m
[36m@@ -80,29 +80,34 @@[m [mexport function QuickActions() {[m
       <div className="flex items-center justify-between mb-3">[m
         <h3 className="text-lg font-semibold text-foreground">{t('quickActions.title')}</h3>[m
       </div>[m
[31m-      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">[m
[32m+[m[32m      <div className="grid grid-cols-3 gap-2 md:gap-3">[m
         {actions.map((action, index) => ([m
           <Link[m
             key={action.path}[m
             to={action.path}[m
             className={cn([m
[31m-              "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-300 card-hover fade-in relative overflow-hidden group",[m
[31m-              // Glassmorphism base for all buttons[m
[32m+[m[32m              "flex flex-col items-center justify-center gap-2 p-2 rounded-xl border transition-all duration-300 card-hover fade-in relative overflow-hidden group h-24 md:h-28",[m
               "bg-card/30 backdrop-blur-sm hover:bg-card/50",[m
               colorStyles[action.color][m
             )}[m
             style={{ animationDelay: `${index * 50}ms` }}[m
           >[m
             <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />[m
[31m-            <div className="p-2.5 rounded-xl bg-background/50 backdrop-blur-md shadow-sm group-hover:scale-110 transition-transform duration-300">[m
[32m+[m[32m            <div className="p-2 rounded-lg bg-background/50 backdrop-blur-md shadow-sm group-hover:scale-110 transition-transform duration-300">[m
               <action.icon className="w-5 h-5" />[m
             </div>[m
[31m-            <div className="text-center z-10">[m
[31m-              <p className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">{t(action.labelKey)}</p>[m
[31m-              <p className="text-[10px] text-muted-foreground/80 mt-0.5 line-clamp-1">{t(action.descriptionKey)}</p>[m
[32m+[m[32m            <div className="text-center z-10 w-full px-1">[m
[32m+[m[32m              <p className="font-semibold text-foreground text-xs md:text-sm whitespace-nowrap overflow-hidden text-ellipsis group-hover:text-primary transition-colors">{t(action.labelKey)}</p>[m
             </div>[m
           </Link>[m
         ))}[m
[32m+[m[32m        {/* 2 Empty Placeholders for 3x3 Grid */}[m
[32m+[m[32m        <div className="h-24 md:h-28 rounded-xl border border-dashed border-border/30 bg-muted/5 backdrop-blur-sm flex items-center justify-center opacity-50">[m
[32m+[m[32m          <span className="sr-only">Empty Slot 1</span>[m
[32m+[m[32m        </div>[m
[32m+[m[32m        <div className="h-24 md:h-28 rounded-xl border border-dashed border-border/30 bg-muted/5 backdrop-blur-sm flex items-center justify-center opacity-50">[m
[32m+[m[32m          <span className="sr-only">Empty Slot 2</span>[m
[32m+[m[32m        </div>[m
       </div>[m
     </div>[m
   );[m
