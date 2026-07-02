import { Outlet } from "react-router-dom";
import { AuthGate } from "@/components/AuthGate.jsx";

export function RootLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AuthGate>
        <Outlet />
      </AuthGate>
    </div>
  );
}
