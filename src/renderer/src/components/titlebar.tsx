import { cn } from "@/lib/utils"

interface TitlebarProps {
  title: string
  className?: string
}

export function Titlebar({ title, className }: TitlebarProps) {
  return (
    <div
      className={cn(
        "h-12 flex items-center border-b border-border px-4 shrink-0",
        "[-webkit-app-region:drag]",
        className
      )}
    >
      <div className="w-[68px]" />
      <span className="text-sm font-medium text-muted-foreground">{title}</span>
    </div>
  )
}
