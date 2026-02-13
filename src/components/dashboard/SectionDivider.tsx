interface SectionDividerProps {
  title: string;
}

export function SectionDivider({ title }: SectionDividerProps) {
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap px-2">
        {title}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}
