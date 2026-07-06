export const BROWSER_TZ = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
})();

export const TIMEZONES = (() => {
  try {
    if (typeof Intl.supportedValuesOf === "function") {
      return Intl.supportedValuesOf("timeZone");
    }
  } catch {
    /* noop */
  }
  return [
    "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
    "America/Toronto", "America/Sao_Paulo", "Europe/London", "Europe/Paris", "Europe/Berlin",
    "Europe/Madrid", "Europe/Moscow", "Africa/Johannesburg", "Asia/Dubai", "Asia/Kolkata",
    "Asia/Bangkok", "Asia/Singapore", "Asia/Hong_Kong", "Asia/Shanghai", "Asia/Tokyo",
    "Asia/Seoul", "Australia/Sydney", "Pacific/Auckland",
  ];
})();

export function toLocalInput(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function dateKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function addInterval(d, unit, n) {
  const r = new Date(d);
  if (unit === "day") r.setDate(r.getDate() + n);
  else if (unit === "week") r.setDate(r.getDate() + n * 7);
  else r.setMonth(r.getMonth() + n);
  return r;
}

export function expandEvent(e, rangeStart, rangeEnd) {
  const out = [];
  const base = new Date(e.starts_at);
  const skip = new Set((e.exception_dates || []).map((d) => new Date(d).getTime()));
  if (e.recurrence === "none") {
    if (base >= rangeStart && base <= rangeEnd && !skip.has(base.getTime())) {
      out.push({ event: e, date: base, key: `${e.id}-${base.getTime()}` });
    }
    return out;
  }
  let unit = "week";
  let interval = 1;
  if (e.recurrence === "daily") { unit = "day"; interval = 1; }
  else if (e.recurrence === "weekly") { unit = "week"; interval = 1; }
  else if (e.recurrence === "biweekly") { unit = "week"; interval = 2; }
  else if (e.recurrence === "monthly") { unit = "month"; interval = 1; }
  else if (e.recurrence === "custom") { unit = "week"; interval = Math.max(1, e.recurrence_interval || 1); }
  const until = e.recurrence_until ? new Date(e.recurrence_until) : null;
  let cur = new Date(base);
  let guard = 0;
  while (cur <= rangeEnd && guard < 500) {
    if (until && cur > until) break;
    if (cur >= rangeStart && !skip.has(cur.getTime())) {
      out.push({ event: e, date: new Date(cur), key: `${e.id}-${cur.getTime()}` });
    }
    cur = addInterval(cur, unit, interval);
    guard++;
  }
  return out;
}

export function recurrenceLabel(e) {
  switch (e.recurrence) {
    case "daily": return "Repeats daily";
    case "weekly": return "Repeats weekly";
    case "biweekly": return "Repeats every 2 weeks";
    case "monthly": return "Repeats monthly";
    case "custom": return `Repeats every ${e.recurrence_interval} weeks`;
    default: return "Does not repeat";
  }
}

export function fmt(ms) {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Match current session to meeting host list (by ghl id, then name/email). */
export function resolveMeetingHost({ hostIds, session, users = [] }) {
  if (session?.isSuperAdmin) return true;
  if (!hostIds?.length) return false;

  const ids = hostIds.map(String);
  if (session?.ghlUserId && ids.includes(String(session.ghlUserId))) return true;

  const sessionName = session?.name?.trim().toLowerCase();
  const sessionEmail = session?.email?.trim().toLowerCase();

  for (const hostId of ids) {
    const u = users.find((x) => String(x.ghl_id ?? x.id) === String(hostId));
    if (!u) continue;
    if (sessionName && u.name?.trim().toLowerCase() === sessionName) return true;
    if (sessionEmail && u.email?.trim().toLowerCase() === sessionEmail) return true;
  }

  return false;
}

/** Resolve GHL assignee from issue owner name or fall back to current session user. */
export function resolveAssigneeFromOwner(ownerName, users, session) {
  const matchName = ownerName?.trim().toLowerCase();
  if (matchName) {
    const u = users.find(
      (x) => x.name?.trim().toLowerCase() === matchName
        || x.email?.trim().toLowerCase() === matchName,
    );
    if (u) {
      const id = u.ghl_id ?? u.id;
      const name = u.name || u.email || id;
      return { id, name };
    }
  }
  if (session?.ghlUserId) {
    return {
      id: session.ghlUserId,
      name: session.name || session.email || session.ghlUserId,
    };
  }
  return null;
}
