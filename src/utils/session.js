const ACCESS_KEY = "pages.access";
const REFRESH_KEY = "pages.refresh";

export function loadTokens() {
  return {
    access: localStorage.getItem(ACCESS_KEY),
    refresh: localStorage.getItem(REFRESH_KEY),
  };
}

export function saveTokens(access, refresh) {
  if (access) localStorage.setItem(ACCESS_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function cleanParam(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function readUrlParams() {
  const sources = [
    window.location.search,
    window.location.hash.split("?")[1] ?? "",
    document.referrer.split("?")[1] ?? "",
  ];
  const readParam = (names) => {
    for (const source of sources) {
      const params = new URLSearchParams(source);
      for (const name of names) {
        const value = cleanParam(params.get(name));
        if (value) return value;
      }
    }
    return null;
  };
  const readGhlLocationPath = () => {
    const fromUrl = (value) => cleanParam(value.match(/\/v2\/location\/([^/?#]+)/)?.[1] ?? null);
    return fromUrl(window.location.href) ?? fromUrl(document.referrer);
  };
  return {
    ghl_location_id: readParam(["locid", "locId", "locationId", "location_id"]) ?? readGhlLocationPath(),
    ghl_user_id: readParam(["logid", "userid", "userId", "user_id"]),
    email: readParam(["email", "userEmail", "user_email"]),
  };
}

const ADMIN_KEY = "pages.admin_key";

export function readAdminKey() {
  const sources = [
    window.location.search,
    window.location.hash.split("?")[1] ?? "",
  ];
  for (const source of sources) {
    const params = new URLSearchParams(source);
    const fromUrl = cleanParam(params.get("admin_key"));
    if (fromUrl) {
      localStorage.setItem(ADMIN_KEY, fromUrl);
      return fromUrl;
    }
  }
  return cleanParam(localStorage.getItem(ADMIN_KEY));
}

export function saveAdminKey(key) {
  if (key) localStorage.setItem(ADMIN_KEY, key);
}

export function clearAdminKey() {
  localStorage.removeItem(ADMIN_KEY);
}

const IDENTITY_KEY = "pm.identity.v1";

export function isAdminPath(pathname = window.location.pathname) {
  return pathname.startsWith("/admin") || pathname.startsWith("/connect");
}

export function getIdentity() {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setIdentity(identity) {
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
}
