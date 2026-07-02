import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useGetOAuthConfigMutation } from "@/api/ghlApi.js";
import { Button } from "@/components/ui/Button.jsx";
import { Loader } from "@/components/ui/Loader.jsx";

export function ConnectPage() {
  const [getOAuthConfig] = useGetOAuthConfigMutation();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function startConnect() {
    setLoading(true);
    setError(null);
    try {
      const redirectUri = `${window.location.origin}/connect/callback`;
      const config = await getOAuthConfig({ redirect_uri: redirectUri }).unwrap();
      if (!config?.authorize_url) {
        throw new Error("OAuth config missing authorize_url");
      }
      window.location.href = config.authorize_url;
    } catch (err) {
      setError(err?.data?.error ?? err?.message ?? "Failed to start OAuth");
      setLoading(false);
    }
  }

  useEffect(() => {
    startConnect();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full border rounded-lg bg-card p-8 text-center space-y-4">
        <h1 className="text-xl font-semibold">Connect GoHighLevel</h1>
        <p className="text-sm text-muted-foreground">
          Redirecting to the GHL marketplace to authorize this app for your sub-account.
        </p>
        {loading && <Loader />}
        {error && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={startConnect} disabled={loading}>
              Try again
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          <Link to="/admin" className="underline">
            Back to admin
          </Link>
        </p>
      </div>
    </div>
  );
}
