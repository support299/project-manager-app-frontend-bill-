export function recurrenceLabel(task) {
  switch (task?.recurrence) {
    case "daily": return "Repeats daily";
    case "weekly": return "Repeats weekly";
    case "biweekly": return "Repeats every 2 weeks";
    case "monthly": return "Repeats monthly";
    case "custom": return `Repeats every ${task.recurrence_interval || 1} days`;
    default: return "Does not repeat";
  }
}

/** First due date for a new recurring task (YYYY-MM-DD for date inputs). */
export function computeDueDateInputValue(recurrence, interval = 1, from = new Date()) {
  if (!recurrence || recurrence === "none") return "";
  const d = new Date(from);
  switch (recurrence) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "biweekly":
      d.setDate(d.getDate() + 14);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "custom":
      d.setDate(d.getDate() + Math.max(1, interval || 1));
      break;
    default:
      return "";
  }
  return d.toISOString().slice(0, 10);
}

export function dueDateIsoFromInput(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr + "T12:00:00").toISOString();
}

const RECURRENCE_LABEL = {
  none: "Does not repeat",
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  custom: "Custom",
};

function parseJsonList(v) {
  if (v == null || v === "") return [];
  try {
    const parsed = JSON.parse(v);
    if (Array.isArray(parsed)) return parsed;
    if (parsed == null) return [];
    return [String(parsed)];
  } catch {
    return typeof v === "string" ? [v] : [];
  }
}

function truncate(text, max = 100) {
  if (!text) return "";
  const s = String(text).replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function quote(text, max = 100) {
  const s = truncate(text, max);
  return s ? `"${s}"` : '""';
}

function diffLists(from, to) {
  const fromList = parseJsonList(from);
  const toList = parseJsonList(to);
  const fromSet = new Set(fromList);
  const toSet = new Set(toList);
  return {
    added: toList.filter((x) => !fromSet.has(x)),
    removed: fromList.filter((x) => !toSet.has(x)),
  };
}

function formatListChanges(fieldLabel, from, to) {
  const { added, removed } = diffLists(from, to);
  const parts = [];

  if (removed.length === 1) {
    parts.push(`removed ${quote(removed[0])} from ${fieldLabel}`);
  } else if (removed.length > 1) {
    parts.push(`removed ${removed.map((x) => quote(x)).join(", ")} from ${fieldLabel}`);
  }

  if (added.length === 1) {
    parts.push(`added ${quote(added[0])} to ${fieldLabel}`);
  } else if (added.length > 1) {
    parts.push(`added ${added.map((x) => quote(x)).join(", ")} to ${fieldLabel}`);
  }

  if (parts.length === 0) return `updated ${fieldLabel}`;
  return parts.join(" and ");
}

function formatDescriptionChange(from, to) {
  const fromText = (from ?? "").trim();
  const toText = (to ?? "").trim();

  if (!fromText && toText) {
    return { text: `set the description to ${quote(toText)}`, detail: toText.length > 100 ? toText : null };
  }
  if (fromText && !toText) {
    return { text: "cleared the description", detail: null };
  }
  if (fromText && toText) {
    return {
      text: `changed the description from ${quote(fromText)} to ${quote(toText)}`,
      detail: toText.length > 100 ? toText : null,
    };
  }
  return { text: "updated the description", detail: null };
}

function formatDuration(seconds) {
  const n = Number(seconds);
  if (!n || Number.isNaN(n)) return "time";
  if (n < 60) return `${n}s`;
  const mins = Math.floor(n / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function projectName(id, projectById) {
  if (!id) return "No project";
  return projectById?.[id]?.title ?? "Unknown project";
}

export function formatHistoryEntry(entry, { statusLabel, priorityLabel, projectById } = {}) {
  const who = entry.changed_by || "Someone";
  const field = entry.field;
  const from = entry.from_value;
  const to = entry.to_value;
  const when = entry.created_at;

  if (entry.action === "created") {
    const title = to ? quote(to, 80) : "this task";
    return { who, text: `created ${title}`, when };
  }

  if (entry.action === "comment_added" || field === "comment") {
    const body = to ?? "";
    return {
      who,
      text: "added a comment",
      detail: body || null,
      when,
    };
  }

  if (entry.action === "time_logged" || field === "time") {
    return { who, text: `logged ${formatDuration(to)} of time`, when };
  }

  if (entry.action === "file_added" || (field === "file" && to)) {
    return { who, text: `attached ${quote(to, 80)}`, when };
  }

  if (entry.action === "file_removed" || (field === "file" && from && !to)) {
    return { who, text: `removed attachment ${quote(from, 80)}`, when };
  }

  if (entry.action === "status_changed" || field === "status") {
    const fromLabel = from?.startsWith("custom:") ? from.slice(7) : (statusLabel?.[from] ?? from ?? "—");
    const toLabel = to?.startsWith("custom:") ? to.slice(7) : (statusLabel?.[to] ?? to ?? "—");
    return { who, text: `changed status from ${quote(fromLabel, 40)} to ${quote(toLabel, 40)}`, when };
  }

  if (field === "title") {
    if (from && to && from !== to) {
      return { who, text: `renamed from ${quote(from, 60)} to ${quote(to, 60)}`, when };
    }
    return { who, text: `renamed to ${quote(to, 60)}`, when };
  }

  if (field === "description") {
    const { text, detail } = formatDescriptionChange(from, to);
    return { who, text, detail, when };
  }

  if (field === "priority") {
    const fromLabel = priorityLabel?.[from] ?? from ?? "—";
    const toLabel = priorityLabel?.[to] ?? to ?? "—";
    return { who, text: `changed priority from ${fromLabel} to ${toLabel}`, when };
  }

  if (field === "due_date") {
    const fmt = (v) => (v ? new Date(v).toLocaleDateString() : "none");
    return { who, text: `changed due date from ${fmt(from)} to ${fmt(to)}`, when };
  }

  if (field === "assignees") {
    return { who, text: formatListChanges("assignees", from, to), when };
  }

  if (field === "contact") {
    const fromLabel = from || "none";
    const toLabel = to || "none";
    if (!from && to) return { who, text: `set contact to ${quote(toLabel, 60)}`, when };
    if (from && !to) return { who, text: `removed contact ${quote(fromLabel, 60)}`, when };
    return { who, text: `changed contact from ${quote(fromLabel, 60)} to ${quote(toLabel, 60)}`, when };
  }

  if (field === "project") {
    const fromName = projectName(from, projectById);
    const toName = projectName(to, projectById);
    if (!from && to) return { who, text: `added to project ${quote(toName, 60)}`, when };
    if (from && !to) return { who, text: `removed from project ${quote(fromName, 60)}`, when };
    return { who, text: `moved from ${quote(fromName, 60)} to ${quote(toName, 60)}`, when };
  }

  if (field === "labels") {
    return { who, text: formatListChanges("labels", from, to), when };
  }

  if (field === "recurrence") {
    const fromLabel = RECURRENCE_LABEL[from] ?? from ?? "none";
    const toLabel = RECURRENCE_LABEL[to] ?? to ?? "none";
    return { who, text: `changed repeat from ${fromLabel} to ${toLabel}`, when };
  }

  if (field === "recurrence_interval") {
    return { who, text: `changed repeat interval from every ${from ?? "—"} days to every ${to ?? "—"} days`, when };
  }

  if (field === "recurrence_until") {
    const fmt = (v) => (v ? new Date(v).toLocaleDateString() : "none");
    return { who, text: `changed repeat end date from ${fmt(from)} to ${fmt(to)}`, when };
  }

  return { who, text: `updated ${field || "task"}`, when };
}
