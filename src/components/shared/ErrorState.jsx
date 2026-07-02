import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button.jsx";

export function ErrorState({ title = "Something went wrong", message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <div>
        <h3 className="font-medium">{title}</h3>
        {message && <p className="mt-1 text-sm text-muted-foreground">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
