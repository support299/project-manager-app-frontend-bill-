import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { useResolveSessionMutation } from "@/api/authApi.js";
import { selectAuth } from "@/store/authSlice.js";
import { isAdminPath, saveAdminKey } from "@/utils/session.js";
import { Button } from "@/components/ui/Button.jsx";
import { Input } from "@/components/ui/Input.jsx";
import { Label } from "@/components/ui/Label.jsx";

function SignInRequired({ message }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-foreground">Sign-in required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {message || "Open this app from your GHL sub-account to continue."}
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Your GHL custom menu should pass <code className="text-foreground">location_id</code> and{" "}
          <code className="text-foreground">email</code> as query parameters.
        </p>
        <Button variant="outline" size="sm" className="mt-6" asChild>
          <Link to="/login">Super admin sign in</Link>
        </Button>
      </div>
    </div>
  );
}

function AdminKeyPrompt() {
  const [key, setKey] = useState("");
  const [error, setError] = useState(null);
  const [resolveSession, { isLoading }] = useResolveSessionMutation();

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!key.trim()) return;
    saveAdminKey(key.trim());
    try {
      await resolveSession({ admin_key: key.trim() }).unwrap();
    } catch (err) {
      const errors = err?.data?.errors;
      const detail = Array.isArray(errors) ? errors[0]?.detail : null;
      setError(detail || "Invalid admin key");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm space-y-4"
      >
        <div>
          <h1 className="text-lg font-semibold text-foreground">Admin access</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter your admin bootstrap key.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-key">Admin key</Label>
          <Input
            id="admin-key"
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Signing in…" : "Continue"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          <Link to="/login" className="underline-offset-4 hover:underline">
            Sign in with email instead
          </Link>
        </p>
      </form>
    </div>
  );
}

export function AuthGate({ children }) {
  const { pathname } = useLocation();
  const { loaded, authError, accessToken, session } = useSelector(selectAuth);
  const adminRoute = isAdminPath(pathname);
  const isLoginRoute = pathname === "/login";

  if (isLoginRoute) {
    return children;
  }

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Signing in…
      </div>
    );
  }

  if (adminRoute) {
    const hasSuperAdmin = accessToken && session?.is_super_admin;
    if (!hasSuperAdmin) {
      return <AdminKeyPrompt />;
    }
    return children;
  }

  const hasAppAccess =
    accessToken && (session?.ghl_user_id || session?.is_super_admin);
  if (!hasAppAccess) {
    return <SignInRequired message={authError} />;
  }

  return children;
}
