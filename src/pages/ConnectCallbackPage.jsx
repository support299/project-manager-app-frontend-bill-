import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useExchangeCodeMutation } from "@/api/ghlApi.js";
import { Button } from "@/components/ui/Button.jsx";
import { Loader } from "@/components/ui/Loader.jsx";

const EXCHANGE_PREFIX = "ghl.oauth.exchange.";
const inflightByCode = new Map();

function readCachedResult(code) {
  try {
    const raw = sessionStorage.getItem(`${EXCHANGE_PREFIX}${code}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function cacheResult(code, data) {
  sessionStorage.setItem(`${EXCHANGE_PREFIX}${code}`, JSON.stringify(data));
}

function exchangeErrorMessage(err) {
  const payload = err?.data?.data ?? err?.data ?? err;
  return payload?.error ?? err?.message ?? "Token exchange failed";
}

export function ConnectCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [exchangeCode] = useExchangeCodeMutation();
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const oauthError = searchParams.get("error");

    if (oauthError) {
      setError(searchParams.get("error_description") || oauthError);
      return;
    }
    if (!code) {
      setError("Missing authorization code in callback URL");
      return;
    }

    const cached = readCachedResult(code);
    if (cached?.ok) {
      setResult(cached);
      navigate("/admin", { replace: true });
      return;
    }

    let promise = inflightByCode.get(code);
    if (!promise) {
      const redirectUri = `${window.location.origin}/connect/callback`;
      const locationId =
        searchParams.get("locationId") ||
        searchParams.get("location_id") ||
        searchParams.get("locid") ||
        undefined;
      promise = exchangeCode({
        code,
        redirect_uri: redirectUri,
        ...(locationId ? { location_id: locationId } : {}),
      }).unwrap();
      inflightByCode.set(code, promise);
      promise.finally(() => inflightByCode.delete(code));
    }

    promise
      .then((data) => {
        cacheResult(code, data);
        setResult(data);
        navigate("/admin", { replace: true });
      })
      .catch((err) => {
        setError(exchangeErrorMessage(err));
      });
  }, [searchParams, exchangeCode, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full border rounded-lg bg-card p-8 text-center space-y-4">
        <h1 className="text-xl font-semibold">Connecting…</h1>
        {!error && !result && <Loader />}
        {result && (
          <div className="space-y-2">
            <p className="text-sm text-green-600">Connected successfully.</p>
            {result.location?.name && (
              <p className="text-sm text-muted-foreground">
                Location: <strong>{result.location.name}</strong>
              </p>
            )}
            {typeof result.locations_connected === "number" && result.locations_connected > 1 && (
              <p className="text-sm text-muted-foreground">
                {result.locations_connected} locations connected.
              </p>
            )}
            {result.sync_queued && (
              <p className="text-sm text-muted-foreground">
                User and contact sync is running in the background.
              </p>
            )}
            {!result.sync_queued && typeof result.users_synced === "number" && (
              <p className="text-sm text-muted-foreground">{result.users_synced} users synced.</p>
            )}
            {!result.sync_queued && typeof result.contacts_synced === "number" && (
              <p className="text-sm text-muted-foreground">
                {result.contacts_synced} contacts synced.
              </p>
            )}
            {Array.isArray(result.skipped_locations) && result.skipped_locations.length > 0 && (
              <p className="text-sm text-amber-600">
                Skipped {result.skipped_locations.length} inactive sub-account
                {result.skipped_locations.length === 1 ? "" : "s"}.
              </p>
            )}
            <p className="text-xs text-muted-foreground">Redirecting to admin…</p>
          </div>
        )}
        {error && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button asChild>
              <Link to="/connect">Try again</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
