import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useResolveSessionMutation } from "@/api/authApi.js";
import { Button } from "@/components/ui/Button.jsx";
import { Input } from "@/components/ui/Input.jsx";
import { Label } from "@/components/ui/Label.jsx";

export function SuperAdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [resolveSession, { isLoading }] = useResolveSessionMutation();

  async function submit(e) {
    e.preventDefault();
    setError(null);
    try {
      await resolveSession({
        super_admin_email: email.trim(),
        super_admin_password: password,
      }).unwrap();
      navigate("/", { replace: true });
    } catch (err) {
      const errors = err?.data?.errors;
      const detail = Array.isArray(errors) ? errors[0]?.detail : null;
      setError(detail || "Invalid email or password");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm space-y-4"
      >
        <div>
          <h1 className="text-lg font-semibold text-foreground">Super admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with your Django superuser account (<code>createsuperuser</code>).
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="super-admin-email">Username or email</Label>
          <Input
            id="super-admin-email"
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="super-admin-password">Password</Label>
          <Input
            id="super-admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          GHL user?{" "}
          <Link to="/" className="text-foreground underline-offset-4 hover:underline">
            Open from your sub-account
          </Link>
        </p>
      </form>
    </div>
  );
}
