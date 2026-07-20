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
  if (session?.isSuperAdmin || session?.isAdmin) return true;
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

/** ISO occurrence key for a Date (matches calendar `?occ=` links). */
export function occurrenceKeyFromDate(d) {
  return new Date(d).toISOString();
}

export function parseOccurrenceDate(occurrenceKey) {
  if (!occurrenceKey || occurrenceKey === "default") return null;
  const d = new Date(occurrenceKey);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Compare occurrence keys / dates by local calendar day (ignores time / ISO ms drift). */
export function sameScorecardDay(a, b) {
  const da = a instanceof Date ? a : parseOccurrenceDate(a);
  const db = b instanceof Date ? b : parseOccurrenceDate(b);
  if (!da || !db) return false;
  return (
    da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate()
  );
}

/**
 * True when `occurrence` falls in the 7-day window starting at `weekStart`
 * (meeting day through +6 days) — used when Gem Review collapses daily meetings to weeks.
 */
export function occurrenceInScorecardWeek(occurrence, weekStart) {
  const d = occurrence instanceof Date ? occurrence : parseOccurrenceDate(occurrence);
  const start = weekStart instanceof Date ? weekStart : parseOccurrenceDate(weekStart);
  if (!d || !start || Number.isNaN(d.getTime()) || Number.isNaN(start.getTime())) return false;
  const from = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 6);
  to.setHours(23, 59, 59, 999);
  const t = d.getTime();
  return t >= from.getTime() && t <= to.getTime();
}

/** Daily meetings still need one Gem/Scorecard "week" column per week. */
function eventForWeekColumns(event, { forceWeekly = false } = {}) {
  if (!event) return event;
  if (forceWeekly && event.recurrence === "daily") {
    return { ...event, recurrence: "weekly" };
  }
  return event;
}

/**
 * Build week/period columns for a scorecard year from event recurrence + logged values.
 * Pass `{ forceWeekly: true }` for Gem Review so daily events still get W1…Wn (7 days apart).
 */
export function buildScorecardWeekColumns(event, year, values = [], options = {}) {
  if (!event) return [];
  const forceWeekly = Boolean(options.forceWeekly);
  const expandEventSource = eventForWeekColumns(event, { forceWeekly });
  const rangeStart = new Date(year, 0, 1, 0, 0, 0, 0);
  const rangeEnd = new Date(year, 11, 31, 23, 59, 59, 999);
  const byKey = new Map();

  for (const occ of expandEvent(expandEventSource, rangeStart, rangeEnd)) {
    const key = occurrenceKeyFromDate(occ.date);
    byKey.set(key, { key, date: occ.date, label: formatScorecardWeekLabel(occ.date) });
  }

  for (const v of values) {
    const d = parseOccurrenceDate(v.occurrence_key);
    if (!d || d.getFullYear() !== year) continue;
    if (byKey.has(v.occurrence_key)) continue;
    if (forceWeekly) {
      let covered = false;
      for (const col of byKey.values()) {
        if (occurrenceInScorecardWeek(d, col.date)) {
          covered = true;
          break;
        }
      }
      if (covered) continue;
    }
    byKey.set(v.occurrence_key, {
      key: v.occurrence_key,
      date: d,
      label: formatScorecardWeekLabel(d),
    });
  }

  return [...byKey.values()].sort((a, b) => a.date - b.date);
}

/** 12 month columns for monthly cadence metrics. */
export function buildScorecardMonthColumns(year) {
  return Array.from({ length: 12 }, (_, month) => {
    const date = new Date(year, month, 1, 12, 0, 0, 0);
    return {
      key: `month:${year}-${String(month + 1).padStart(2, "0")}`,
      month,
      year,
      date,
      label: date.toLocaleString(undefined, { month: "short" }),
    };
  });
}

export function formatScorecardWeekLabel(d) {
  const start = new Date(d);
  return `${start.getMonth() + 1}/${start.getDate()}`;
}

/** Sheet-style week header: "1/26-2/1" (meeting day through +6 days). */
export function formatScorecardWeekRangeLabel(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "—";
  const start = new Date(d);
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  return `${start.getMonth() + 1}/${start.getDate()}-${end.getMonth() + 1}/${end.getDate()}`;
}

/** Years that have scorecard data, plus current year and event start year. */
export function scorecardYearOptions(event, values = [], now = new Date()) {
  const years = new Set([now.getFullYear()]);
  const start = parseOccurrenceDate(event?.starts_at);
  if (start) years.add(start.getFullYear());
  for (const v of values) {
    const d = parseOccurrenceDate(v.occurrence_key);
    if (d) years.add(d.getFullYear());
  }
  return [...years].sort((a, b) => b - a);
}

/** Calendar quarter 1–4 from a Date. */
export function scorecardQuarterFromDate(d) {
  if (!d || Number.isNaN(d.getTime())) return 1;
  return Math.floor(d.getMonth() / 3) + 1;
}

/**
 * Filter week/month columns to a short window or quarter.
 * Never returns an unbounded full-year dump for "all".
 */
export function filterScorecardColumnsByRange(columns, range, opts = {}) {
  if (!columns?.length) return [];

  const findFocusIndex = () => {
    let idx = -1;
    if (opts.focusKey) {
      idx = columns.findIndex((c) => c.key === opts.focusKey || sameScorecardDay(c.key, opts.focusKey));
    }
    if (idx < 0 && opts.focusDate) {
      const t = opts.focusDate.getTime();
      let best = { i: columns.length - 1, dist: Infinity };
      columns.forEach((col, i) => {
        const dist = Math.abs(col.date.getTime() - t);
        if (dist < best.dist) best = { i, dist };
      });
      idx = best.i;
    }
    if (idx < 0) idx = columns.length - 1;
    return idx;
  };

  if (range === "recent" || !range) {
    const count = Math.max(1, opts.recentCount ?? 5);
    const idx = findFocusIndex();
    const start = Math.max(0, idx - (count - 1));
    const end = Math.min(columns.length, idx + 1);
    return columns.slice(start, end);
  }

  if (range === "all") {
    const max = Math.max(8, opts.maxColumns ?? 12);
    const idx = findFocusIndex();
    const half = Math.floor(max / 2);
    const start = Math.max(0, idx - half);
    return columns.slice(start, Math.min(columns.length, start + max));
  }

  const q = Number(range);
  if (![1, 2, 3, 4].includes(q)) return columns;
  return columns.filter((col) => scorecardQuarterFromDate(col.date) === q);
}

export function scorecardRangeLabel(range, year) {
  if (range === "recent" || !range) return "recent weeks";
  if (range === "all") return `near this meeting · ${year}`;
  return `Q${range} ${year}`;
}

/** Event already fires every 2+ weeks — biweekly metrics use every occurrence. */
export function eventIsAlreadyBiweeklyOrSlower(event) {
  if (!event) return false;
  if (event.recurrence === "biweekly" || event.recurrence === "monthly") return true;
  if (event.recurrence === "custom" && Math.max(1, event.recurrence_interval || 1) >= 2) return true;
  return false;
}

/**
 * Keep every other week column for biweekly metrics (aligned to year series).
 * Weekly cadence returns columns unchanged.
 */
export function filterColumnsForCadence(fullYearColumns, visibleColumns, cadence, event) {
  if (!visibleColumns?.length) return [];
  if (cadence !== "biweekly") return visibleColumns;
  if (eventIsAlreadyBiweeklyOrSlower(event)) return visibleColumns;
  const keys = new Set(
    (fullYearColumns || [])
      .filter((_, i) => i % 2 === 0)
      .map((c) => c.key),
  );
  return visibleColumns.filter((c) => keys.has(c.key));
}

/** Whether this meeting occurrence is an active log week for the metric cadence. */
export function isCadenceActiveForOccurrence(fullYearColumns, occurrenceKey, cadence, event) {
  if (!cadence || cadence === "weekly") return true;

  if (cadence === "monthly") {
    // Monthly meetings already one per month — always active.
    if (event?.recurrence === "monthly") return true;
    const focus = parseOccurrenceDate(occurrenceKey);
    if (!focus || !fullYearColumns?.length) return true;
    const y = focus.getFullYear();
    const m = focus.getMonth();
    const inMonth = fullYearColumns.filter(
      (c) => c.date.getFullYear() === y && c.date.getMonth() === m,
    );
    if (!inMonth.length) return true;
    let matchIdx = inMonth.findIndex((c) => c.key === occurrenceKey);
    if (matchIdx < 0) {
      let best = { i: 0, dist: Infinity };
      inMonth.forEach((col, i) => {
        const dist = Math.abs(col.date.getTime() - focus.getTime());
        if (dist < best.dist) best = { i, dist };
      });
      matchIdx = best.i;
    }
    // First meeting of the month is the monthly log occurrence.
    return matchIdx === 0;
  }

  if (cadence !== "biweekly") return true;
  if (eventIsAlreadyBiweeklyOrSlower(event)) return true;
  if (!fullYearColumns?.length) return true;
  let idx = fullYearColumns.findIndex((c) => c.key === occurrenceKey);
  if (idx < 0) {
    const focus = parseOccurrenceDate(occurrenceKey);
    if (!focus) return true;
    let best = { i: 0, dist: Infinity };
    fullYearColumns.forEach((col, i) => {
      const dist = Math.abs(col.date.getTime() - focus.getTime());
      if (dist < best.dist) best = { i, dist };
    });
    idx = best.i;
  }
  return idx % 2 === 0;
}

/** Map measurable_id -> occurrence_key -> value row */
export function indexMeasurableValues(values = []) {
  const byMeasurable = new Map();
  for (const v of values) {
    let inner = byMeasurable.get(v.measurable_id);
    if (!inner) {
      inner = new Map();
      byMeasurable.set(v.measurable_id, inner);
    }
    inner.set(v.occurrence_key, v);
  }
  return byMeasurable;
}

/** Pick value for a month column: prefer exact month key, else any occurrence in that month. */
export function findMonthlyValue(valueMap, year, month) {
  if (!valueMap) return null;
  const monthKey = `month:${year}-${String(month + 1).padStart(2, "0")}`;
  if (valueMap.has(monthKey)) return valueMap.get(monthKey);
  for (const [key, v] of valueMap) {
    const d = parseOccurrenceDate(key);
    if (d && d.getFullYear() === year && d.getMonth() === month) return v;
  }
  return null;
}

export function scorecardCellStatus(actual, goal) {
  if (actual == null || goal == null) return "none";
  return Number(actual) >= Number(goal) ? "on" : "off";
}

export function scorecardSumAvg(nums) {
  const list = nums.filter((n) => n != null && !Number.isNaN(Number(n))).map(Number);
  if (list.length === 0) return { sum: null, avg: null, count: 0 };
  const sum = list.reduce((a, b) => a + b, 0);
  return { sum, avg: sum / list.length, count: list.length };
}

/** % of periods that met goal (on track). */
export function scorecardWinRate(points, goal) {
  if (goal == null) return null;
  let scored = 0;
  let wins = 0;
  for (const p of points) {
    if (p.actual == null) continue;
    scored += 1;
    if (scorecardCellStatus(p.actual, goal) === "on") wins += 1;
  }
  if (scored === 0) return null;
  return (wins / scored) * 100;
}

function resolvePointActual(valueMap, colKey) {
  if (!valueMap) return { actual: null, key: colKey };
  const row = valueMap.get(colKey);
  if (row) return { actual: row.actual ?? null, key: colKey };
  for (const [k, v] of valueMap) {
    if (sameScorecardDay(k, colKey)) return { actual: v.actual ?? null, key: k };
  }
  return { actual: null, key: colKey };
}

/**
 * Full-year week breakdown (W1…Wn, up to ~52) for a metric + year.
 * Weeks come from meeting recurrence — client does not invent columns.
 */
export function buildScorecardYearWeekPoints({
  event,
  measurable,
  valuesByMeasurable,
  year,
  occurrenceKey,
}) {
  const cadence = measurable?.cadence || "weekly";
  const valueMap = valuesByMeasurable?.get(measurable.id);
  const focus = parseOccurrenceDate(occurrenceKey);

  if (cadence === "monthly") {
    return buildScorecardMonthColumns(year).map((col, i) => {
      const row = findMonthlyValue(valueMap, year, col.month);
      const actual = row?.actual ?? null;
      return {
        key: row?.occurrence_key || col.key,
        weekNumber: i + 1,
        label: col.label,
        date: col.date,
        actual,
        status: scorecardCellStatus(actual, measurable.goal),
        isCurrent: focus ? col.month === focus.getMonth() && year === focus.getFullYear() : false,
      };
    });
  }

  const yearCols = buildScorecardWeekColumns(event, year, []);
  const cadenceCols = filterColumnsForCadence(yearCols, yearCols, cadence, event);
  return cadenceCols.map((col, i) => {
    const { actual, key } = resolvePointActual(valueMap, col.key);
    return {
      key,
      weekNumber: i + 1,
      label: `W${i + 1}`,
      dateLabel: formatScorecardWeekLabel(col.date),
      date: col.date,
      actual,
      status: scorecardCellStatus(actual, measurable.goal),
      isCurrent: sameScorecardDay(col.key, occurrenceKey),
    };
  });
}

/**
 * Multi-year monthly archive for one metric (sheet-style year rows).
 * Weekly metrics: month cell = sum of that month’s logged weeks.
 * Monthly metrics: month cell = that month’s value.
 */
export function buildScorecardYearArchive({
  measurable,
  valuesByMeasurable,
  years,
}) {
  const valueMap = valuesByMeasurable?.get(measurable.id);
  const cadence = measurable?.cadence || "weekly";
  const sortedYears = [...years].sort((a, b) => b - a);
  const ascending = [...sortedYears].sort((a, b) => a - b);
  const byYear = new Map();
  let prevTotal = null;

  for (const year of ascending) {
    const months = Array.from({ length: 12 }, (_, month) => {
      if (cadence === "monthly") {
        return findMonthlyValue(valueMap, year, month)?.actual ?? null;
      }
      if (!valueMap) return null;
      let sum = 0;
      let n = 0;
      for (const [k, v] of valueMap) {
        if (v.actual == null) continue;
        const d = parseOccurrenceDate(k);
        if (d && d.getFullYear() === year && d.getMonth() === month) {
          sum += Number(v.actual);
          n += 1;
        }
      }
      return n ? sum : null;
    });
    const { sum, avg } = scorecardSumAvg(months);
    let growthPct = null;
    if (sum != null && prevTotal != null && prevTotal !== 0) {
      growthPct = ((sum - prevTotal) / Math.abs(prevTotal)) * 100;
    }
    if (sum != null) prevTotal = sum;
    byYear.set(year, { year, months, sum, avg, growthPct });
  }

  return sortedYears.map((year) => byYear.get(year));
}

/** Years for archive table (newest first), spanning recent history. */
export function scorecardArchiveYears(event, values = [], span = 10) {
  const fromData = scorecardYearOptions(event, values);
  const maxY = fromData[0] || new Date().getFullYear();
  const years = [];
  for (let y = maxY; y > maxY - span; y -= 1) years.push(y);
  return years;
}

/**
 * Last N period points for a measurable (sparkline / detail).
 * Respects weekly / biweekly / monthly cadence.
 */
export function buildScorecardSparklinePoints({
  event,
  measurable,
  valuesByMeasurable,
  occurrenceKey,
  count = 5,
  year: yearOverride,
}) {
  const cadence = measurable?.cadence || "weekly";
  const focus = parseOccurrenceDate(occurrenceKey) || new Date();
  const year = yearOverride ?? focus.getFullYear();
  const valueMap = valuesByMeasurable?.get(measurable.id);

  if (cadence === "monthly") {
    const months = buildScorecardMonthColumns(year);
    let idx = year === focus.getFullYear() ? focus.getMonth() : months.length - 1;
    const start = Math.max(0, idx - (count - 1));
    return months.slice(start, idx + 1).map((col) => {
      const row = findMonthlyValue(valueMap, year, col.month);
      const actual = row?.actual ?? null;
      return {
        key: row?.occurrence_key || col.key,
        label: col.label,
        date: col.date,
        actual,
        status: scorecardCellStatus(actual, measurable.goal),
        isCurrent: col.month === focus.getMonth() && year === focus.getFullYear(),
      };
    });
  }

  const yearCols = buildScorecardWeekColumns(event, year, []);
  const cadenceCols = filterColumnsForCadence(yearCols, yearCols, cadence, event);
  let idx = cadenceCols.findIndex(
    (c) => c.key === occurrenceKey || sameScorecardDay(c.key, occurrenceKey),
  );
  if (idx < 0) {
    if (year === focus.getFullYear()) {
      let best = { i: cadenceCols.length - 1, dist: Infinity };
      cadenceCols.forEach((col, i) => {
        const dist = Math.abs(col.date.getTime() - focus.getTime());
        if (dist < best.dist) best = { i, dist };
      });
      idx = best.i;
    } else {
      idx = cadenceCols.length - 1;
    }
  }
  const start = Math.max(0, idx - (count - 1));
  return cadenceCols.slice(start, idx + 1).map((col) => {
    const { actual, key: periodKey } = resolvePointActual(valueMap, col.key);
    return {
      key: periodKey,
      label: col.label,
      date: col.date,
      actual,
      status: scorecardCellStatus(actual, measurable.goal),
      isCurrent: sameScorecardDay(col.key, occurrenceKey),
    };
  });
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
