import { Inbox } from "lucide-react";

export function EmptyState({ title = "Nothing here yet", description }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
      <Inbox className="h-8 w-8 opacity-60" />
      <h3 className="font-medium text-foreground">{title}</h3>
      {description && <p className="text-sm">{description}</p>}
    </div>
  );
}
