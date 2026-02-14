import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      duration={2000}
      closeButton
      style={{
        '--width': 'min(80vw, 340px)',
      } as React.CSSProperties}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:!bg-card group-[.toaster]:!opacity-100 group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-xl group-[.toaster]:rounded-xl group-[.toaster]:!backdrop-blur-none group-[.toaster]:border",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-sm",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:!bg-[hsl(var(--success)/0.15)] group-[.toaster]:!text-[hsl(var(--success))] group-[.toaster]:!border-[hsl(var(--success)/0.3)]",
          error: "group-[.toaster]:!bg-[hsl(var(--destructive)/0.15)] group-[.toaster]:!text-[hsl(var(--destructive))] group-[.toaster]:!border-[hsl(var(--destructive)/0.3)]",
          warning: "group-[.toaster]:!bg-[hsl(var(--warning)/0.15)] group-[.toaster]:!text-[hsl(var(--warning))] group-[.toaster]:!border-[hsl(var(--warning)/0.3)]",
          info: "group-[.toaster]:!bg-[hsl(var(--primary)/0.15)] group-[.toaster]:!text-[hsl(var(--primary))] group-[.toaster]:!border-[hsl(var(--primary)/0.3)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
