import { Link, useRouteError } from "react-router-dom";
import { Button } from "@/components/ui/Button.jsx";

export function ErrorPage() {
  const error = useRouteError();
  const message = error?.statusText || error?.message || "An unexpected error occurred";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      <Button asChild>
        <Link to="/">Go home</Link>
      </Button>
    </main>
  );
}
