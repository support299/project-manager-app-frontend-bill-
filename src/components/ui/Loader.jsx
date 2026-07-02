import { Loader2 } from "lucide-react";
import { cn } from "@/utils/cn.js";

export function Loader({ className, label = "Loading..." }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground", className)}>
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
