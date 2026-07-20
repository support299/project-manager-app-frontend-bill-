import { useMemo, useState, Fragment } from "react";
import { Plus, Pencil, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateLevel10RockMutation,
  useUpdateLevel10RockMutation,
  useDeleteLevel10RockMutation,
  useUpsertLevel10RockStatusMutation,
  useCreateLevel10RockNoteMutation,
  useDeleteLevel10RockNoteMutation,
} from "@/api/level10Api.js";
import { getIdentity } from "@/utils/session.js";
import {
  buildScorecardWeekColumns,
  filterScorecardColumnsByRange,
  occurrenceInScorecardWeek,
  parseOccurrenceDate,
  sameScorecardDay,
  scorecardQuarterFromDate,
  scorecardYearOptions,
} from "@/utils/level10.js";
import { Button } from "@/components/ui/Button.jsx";
import { Input } from "@/components/ui/Input.jsx";
import { Textarea } from "@/components/ui/Textarea.jsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select.jsx";

const STATUS_CYCLE = ["not_set", "on_track", "off_track", "complete"];

const HORIZON_OPTIONS = [
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

function apiError(err, fallback) {
  const data = err?.data;
  if (data?.data?.error) return String(data.data.error);
  if (data?.error) return String(data.error);
  if (data?.detail) return String(data.detail);
  if (Array.isArray(data?.errors) && data.errors[0]?.detail) return String(data.errors[0].detail);
  if (typeof data === "object" && data !== null) {
    const first = Object.values(data).flat?.()?.[0];
    if (first) return String(first);
  }
  return err?.message || fallback;
}

function gemDueInputValue(dueDate) {
  if (!dueDate) return "";
  return dueDate.slice(0, 10);
}

function formatGemDueDate(dueDate) {
  if (!dueDate) return null;
  const d = new Date(`${dueDate.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? dueDate : d.toLocaleDateString();
}

function authorInitials(name) {
  const parts = (name || "?").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatNoteTimestamp(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function nextStatus(cur) {
  const i = STATUS_CYCLE.indexOf(cur);
  return STATUS_CYCLE[(i < 0 ? 0 : i + 1) % STATUS_CYCLE.length];
}

function statusForColumn(statusMap, colKey, colDate) {
  if (!statusMap) return "not_set";
  if (statusMap.has(colKey)) return statusMap.get(colKey);
  let best = null;
  let bestTime = -1;
  for (const [key, st] of statusMap.entries()) {
    const match =
      sameScorecardDay(key, colKey)
      || (colDate && occurrenceInScorecardWeek(key, colDate));
    if (!match) continue;
    const d = parseOccurrenceDate(key);
    const t = d ? d.getTime() : 0;
    if (t >= bestTime) {
      best = st;
      bestTime = t;
    }
  }
  return best ?? "not_set";
}

function StatusCell({ status, isCurrent, onClick, title }) {
  const base =
    "min-w-[2.75rem] h-8 px-1 rounded text-[10px] font-semibold uppercase tracking-wide transition border";
  const styles =
    status === "on_track"
      ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-emerald-500/40"
      : status === "off_track"
        ? "bg-destructive/20 text-destructive border-destructive/40"
        : status === "complete"
          ? "bg-orange-500/20 text-orange-800 dark:text-orange-200 border-orange-500/40"
          : "bg-muted/40 text-muted-foreground border-transparent hover:border-border";
  const label =
    status === "on_track" ? "ON" : status === "off_track" ? "OFF" : status === "complete" ? "Done" : "—";

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`${base} ${styles} ${isCurrent ? "ring-2 ring-primary ring-offset-1" : ""}`}
    >
      {label}
    </button>
  );
}

function GemNotesSection({
  rockId,
  notes,
  eventId,
  occurrenceKey,
  session,
  identityKey,
  isHost,
}) {
  const [composing, setComposing] = useState(false);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [createNote] = useCreateLevel10RockNoteMutation();
  const [deleteNote] = useDeleteLevel10RockNoteMutation();

  const authorName = session.name || getIdentity()?.name || "";
  const authorIdentity = identityKey || getIdentity()?.email || getIdentity()?.name || authorName;

  function canDeleteNote(note) {
    if (identityKey && note.author_identity && note.author_identity === identityKey) return true;
    if (session.name && note.author_name === session.name) return true;
    if (getIdentity()?.name && note.author_name === getIdentity().name) return true;
    return isHost;
  }

  async function submitNote() {
    const text = body.trim();
    if (!text) return toast.error("Please enter a note");
    if (!authorName.trim()) return toast.error("Please sign in or set your name to add a note");
    setSaving(true);
    try {
      await createNote({
        eventId,
        rockId,
        occurrence_key: occurrenceKey,
        author_name: authorName.trim(),
        author_identity: authorIdentity,
        body: text,
      }).unwrap();
      setBody("");
      setComposing(false);
    } catch (err) {
      toast.error(apiError(err, "Failed to add note"));
    } finally {
      setSaving(false);
    }
  }

  async function removeNote(note) {
    if (!confirm("Delete this note?")) return;
    try {
      await deleteNote({
        eventId,
        rockId,
        noteId: note.id,
        occurrence_key: occurrenceKey,
      }).unwrap();
    } catch (err) {
      toast.error(apiError(err, "Failed to delete note"));
    }
  }

  return (
    <div className="border-t bg-muted/15 px-4 py-3">
      {notes.length > 0 ? (
        <div className="space-y-3 mb-3">
          {notes.map((note) => (
            <div key={note.id} className="flex gap-3 group">
              <div
                className="h-8 w-8 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center"
                aria-hidden
              >
                {authorInitials(note.author_name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{note.author_name}</span>
                  <span className="text-xs text-muted-foreground">{formatNoteTimestamp(note.created_at)}</span>
                  {canDeleteNote(note) ? (
                    <button
                      type="button"
                      onClick={() => removeNote(note)}
                      className="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-destructive transition"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
                <p className="mt-0.5 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{note.body}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {composing ? (
        <div className="rounded-md border bg-card p-3 space-y-2">
          <div className="text-xs text-muted-foreground">
            Adding note as <span className="font-medium text-foreground">{authorName || "—"}</span>
          </div>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add context, blockers, or progress updates…"
            rows={3}
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setComposing(false); setBody(""); }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={submitNote} disabled={saving}>
              Add note
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="text-sm text-muted-foreground hover:text-foreground transition inline-flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Add a note
        </button>
      )}
    </div>
  );
}

export function GemReviewPanel({
  eventId,
  event,
  occurrenceKey,
  rocks,
  statuses,
  rockNotes,
  isHost,
  users,
  session,
  identityKey,
}) {
  const meetingDate = useMemo(
    () => parseOccurrenceDate(occurrenceKey) || new Date(),
    [occurrenceKey],
  );
  const meetingYear = meetingDate.getFullYear();
  const meetingQuarter = scorecardQuarterFromDate(meetingDate);

  const [horizonFilter, setHorizonFilter] = useState("all");
  const [viewYear, setViewYear] = useState(meetingYear);
  const [weekRange, setWeekRange] = useState(String(meetingQuarter));
  const [expandedId, setExpandedId] = useState(null);

  const [newDesc, setNewDesc] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newHorizon, setNewHorizon] = useState("quarterly");
  const [newYear, setNewYear] = useState(meetingYear);
  const [newQuarter, setNewQuarter] = useState(meetingQuarter);
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editDesc, setEditDesc] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editHorizon, setEditHorizon] = useState("quarterly");
  const [editYear, setEditYear] = useState(meetingYear);
  const [editQuarter, setEditQuarter] = useState(meetingQuarter);

  const [createRock] = useCreateLevel10RockMutation();
  const [updateRock] = useUpdateLevel10RockMutation();
  const [deleteRockMut] = useDeleteLevel10RockMutation();
  const [upsertRockStatus] = useUpsertLevel10RockStatusMutation();

  const yearOptions = useMemo(
    () => scorecardYearOptions(event, statuses),
    [event, statuses],
  );

  const yearWeekColumns = useMemo(
    // Daily meetings still show real weeks (W1…Wn), not one column per day.
    () => buildScorecardWeekColumns(event, viewYear, statuses, { forceWeekly: true }),
    [event, viewYear, statuses],
  );

  const visibleColumns = useMemo(() => {
    if (weekRange === "year") {
      return yearWeekColumns.map((col, i) => ({
        ...col,
        weekNum: i + 1,
        weekLabel: `W${i + 1}`,
      }));
    }
    const q = Number(weekRange);
    const filtered = filterScorecardColumnsByRange(yearWeekColumns, q);
    return filtered.map((col) => {
      const idx = yearWeekColumns.findIndex((c) => c.key === col.key);
      return {
        ...col,
        weekNum: idx + 1,
        weekLabel: `W${idx + 1}`,
      };
    });
  }, [yearWeekColumns, weekRange]);

  const statusByRockOcc = useMemo(() => {
    const m = new Map();
    for (const s of statuses) {
      let inner = m.get(s.rock_id);
      if (!inner) {
        inner = new Map();
        m.set(s.rock_id, inner);
      }
      inner.set(s.occurrence_key, s.status);
    }
    return m;
  }, [statuses]);

  const notesByRock = useMemo(() => {
    const m = new Map();
    for (const n of rockNotes) {
      const list = m.get(n.rock_id) ?? [];
      list.push(n);
      m.set(n.rock_id, list);
    }
    return m;
  }, [rockNotes]);

  const filteredRocks = useMemo(() => {
    return rocks.filter((r) => {
      const horizon = r.horizon || "quarterly";
      if (horizonFilter !== "all" && horizon !== horizonFilter) return false;
      if (r.year != null && r.year !== viewYear) return false;
      if (horizon === "quarterly" && weekRange !== "year" && r.quarter != null) {
        if (r.quarter !== Number(weekRange)) return false;
      }
      return true;
    });
  }, [rocks, horizonFilter, viewYear, weekRange]);

  async function addGem() {
    const description = newDesc.trim();
    if (!description) return toast.error("Gem description is required");
    setAdding(true);
    try {
      await createRock({
        eventId,
        occurrence_key: occurrenceKey,
        description,
        owner: newOwner.trim() || null,
        due_date: newDueDate || null,
        horizon: newHorizon,
        year: newYear || meetingYear,
        quarter: newHorizon === "yearly" ? null : newQuarter,
        sort_order: rocks.length,
      }).unwrap();
      setNewDesc("");
      setNewOwner("");
      setNewDueDate("");
      toast.success("Gem added");
    } catch (err) {
      toast.error(apiError(err, "Failed to add gem"));
    } finally {
      setAdding(false);
    }
  }

  async function cycleStatus(rock, occKey) {
    const map = statusByRockOcc.get(rock.id);
    const cur = statusForColumn(map, occKey);
    const next = nextStatus(cur);
    try {
      await upsertRockStatus({
        eventId,
        rockId: rock.id,
        occurrence_key: occKey,
        status: next,
      }).unwrap();
    } catch (err) {
      toast.error(apiError(err, "Failed to update gem status"));
    }
  }

  function startEdit(r) {
    setEditingId(r.id);
    setEditDesc(r.description);
    setEditOwner(r.owner || "");
    setEditDueDate(gemDueInputValue(r.due_date));
    setEditHorizon(r.horizon || "quarterly");
    setEditYear(r.year ?? meetingYear);
    setEditQuarter(r.quarter ?? meetingQuarter);
  }

  async function saveEdit(r) {
    if (!isHost) return toast.error("Only meeting hosts can edit gems");
    try {
      await updateRock({
        eventId,
        rockId: r.id,
        occurrence_key: occurrenceKey,
        description: editDesc.trim() || r.description,
        owner: editOwner.trim() || null,
        due_date: editDueDate || null,
        horizon: editHorizon,
        year: editYear || null,
        quarter: editHorizon === "yearly" ? null : editQuarter,
      }).unwrap();
      setEditingId(null);
      toast.success("Gem updated");
    } catch (err) {
      toast.error(apiError(err, "Failed to update gem"));
    }
  }

  async function deleteGem(r) {
    if (!isHost) return toast.error("Only meeting hosts can delete gems");
    if (!confirm(`Delete gem "${r.description}"? This removes it from all occurrences.`)) return;
    try {
      await deleteRockMut({ eventId, rockId: r.id, occurrence_key: occurrenceKey }).unwrap();
      toast.success("Gem deleted");
    } catch (err) {
      toast.error(apiError(err, "Failed to delete gem"));
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gem Review</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Yearly & quarterly priorities · weeks 1–52 · 5 minutes
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border bg-card p-0.5">
            {[
              { value: "all", label: "All" },
              { value: "quarterly", label: "Quarterly" },
              { value: "yearly", label: "Yearly" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setHorizonFilter(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-sm transition ${
                  horizonFilter === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Select value={String(viewYear)} onValueChange={(v) => setViewYear(Number(v))}>
            <SelectTrigger className="h-9 w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={weekRange} onValueChange={setWeekRange}>
            <SelectTrigger className="h-9 w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Q1 weeks</SelectItem>
              <SelectItem value="2">Q2 weeks</SelectItem>
              <SelectItem value="3">Q3 weeks</SelectItem>
              <SelectItem value="4">Q4 weeks</SelectItem>
              <SelectItem value="year">Weeks 1–52</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {horizonFilter === "yearly"
            ? "Yearly GEMs"
            : horizonFilter === "quarterly"
              ? "Quarterly GEMs"
              : "GEMs"}
          {weekRange === "year" ? ` · ${viewYear}` : ` · Q${weekRange} ${viewYear}`}
        </div>

        {filteredRocks.length === 0 ? (
          <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground text-center">
            No gems yet — add one below.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border bg-card">
            <table className="w-full text-sm border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2 font-semibold min-w-[100px]">Who</th>
                  <th className="sticky left-[100px] z-10 bg-muted/40 px-3 py-2 font-semibold min-w-[220px]">Priority</th>
                  <th className="px-2 py-2 font-semibold text-center min-w-[72px]">Now</th>
                  {visibleColumns.map((col) => (
                    <th
                      key={col.key}
                      className={`px-1 py-2 font-semibold text-center ${occurrenceInScorecardWeek(occurrenceKey, col.date) ? "text-primary" : ""}`}
                      title={col.date.toLocaleDateString()}
                    >
                      <div>{col.weekLabel}</div>
                      <div className="font-normal normal-case tracking-normal opacity-70">{col.label}</div>
                    </th>
                  ))}
                  <th className="px-2 py-2 font-semibold w-20" />
                </tr>
              </thead>
              <tbody>
                {filteredRocks.map((r) => {
                  const map = statusByRockOcc.get(r.id);
                  const nowStatus = statusForColumn(map, occurrenceKey);
                  const isEditing = editingId === r.id;
                  const notes = notesByRock.get(r.id) ?? [];
                  const horizon = r.horizon || "quarterly";
                  const isExpanded = expandedId === r.id;

                  return (
                    <Fragment key={r.id}>
                      <tr className="border-b last:border-0 hover:bg-muted/20">
                        <td className="sticky left-0 z-10 bg-card px-3 py-2 align-top font-medium whitespace-nowrap">
                          {isEditing ? (
                            <Input value={editOwner} onChange={(e) => setEditOwner(e.target.value)} placeholder="Owner" className="h-8" />
                          ) : (
                            r.owner || "—"
                          )}
                        </td>
                        <td className="sticky left-[100px] z-10 bg-card px-3 py-2 align-top">
                          {isEditing ? (
                            <div className="space-y-2">
                              <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Gem description" />
                              <div className="grid grid-cols-3 gap-1.5">
                                <Select value={editHorizon} onValueChange={setEditHorizon}>
                                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {HORIZON_OPTIONS.map((o) => (
                                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select value={String(editYear)} onValueChange={(v) => setEditYear(Number(v))}>
                                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {yearOptions.map((y) => (
                                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {editHorizon === "quarterly" ? (
                                  <Select value={String(editQuarter)} onValueChange={(v) => setEditQuarter(Number(v))}>
                                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {[1, 2, 3, 4].map((q) => (
                                        <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} className="h-8" />
                                )}
                              </div>
                              {editHorizon === "quarterly" ? (
                                <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} className="h-8" />
                              ) : null}
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="text-left w-full"
                              onClick={() => setExpandedId(isExpanded ? null : r.id)}
                            >
                              <div className="font-medium leading-snug">{r.description}</div>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                                  horizon === "yearly"
                                    ? "bg-sky-500/15 text-sky-800 dark:text-sky-200"
                                    : "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                                }`}>
                                  {horizon === "yearly" ? "Yearly" : `Q${r.quarter ?? "—"}`}
                                </span>
                                {r.due_date ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    {formatGemDueDate(r.due_date)}
                                  </span>
                                ) : null}
                              </div>
                            </button>
                          )}
                        </td>
                        <td className="px-2 py-2 align-top text-center">
                          <StatusCell
                            status={nowStatus}
                            isCurrent
                            onClick={() => cycleStatus(r, occurrenceKey)}
                            title="This meeting"
                          />
                        </td>
                        {visibleColumns.map((col) => {
                          const st = statusForColumn(map, col.key, col.date);
                          return (
                            <td key={col.key} className="px-1 py-2 align-top text-center">
                              <StatusCell
                                status={st}
                                isCurrent={occurrenceInScorecardWeek(occurrenceKey, col.date)}
                                onClick={() => cycleStatus(r, col.key)}
                                title={`${col.weekLabel} · ${col.date.toLocaleDateString()}`}
                              />
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 align-top">
                          {isEditing ? (
                            <div className="flex flex-col gap-1">
                              <Button size="sm" className="h-7 text-xs" onClick={() => saveEdit(r)}>Save</Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
                            </div>
                          ) : isHost ? (
                            <div className="flex items-center gap-0.5">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(r)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteGem(r)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                      {isExpanded && !isEditing ? (
                        <tr className="border-b">
                          <td colSpan={3 + visibleColumns.length + 1} className="p-0">
                            <GemNotesSection
                              rockId={r.id}
                              notes={notes}
                              eventId={eventId}
                              occurrenceKey={occurrenceKey}
                              session={session}
                              identityKey={identityKey}
                              isHost={isHost}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_auto_auto_auto_auto_auto] gap-2 items-end">
          <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Gem description" />
          <Input value={newOwner} onChange={(e) => setNewOwner(e.target.value)} placeholder="Owner" list="gems-owners" />
          <Select value={newHorizon} onValueChange={setNewHorizon}>
            <SelectTrigger className="h-9 w-full min-w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {HORIZON_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(newYear)} onValueChange={(v) => setNewYear(Number(v))}>
            <SelectTrigger className="h-9 w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {newHorizon === "quarterly" ? (
            <Select value={String(newQuarter)} onValueChange={(v) => setNewQuarter(Number(v))}>
              <SelectTrigger className="h-9 w-[90px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((q) => (
                  <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-9 w-[90px]" />
          )}
          <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} className="h-9" />
          <Button onClick={addGem} disabled={adding}><Plus className="h-4 w-4 mr-1.5" />Add</Button>
        </div>
        <datalist id="gems-owners">{users.map((u) => <option key={u.ghl_id} value={u.name || u.email || u.ghl_id} />)}</datalist>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-emerald-500/40" /> ON</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-destructive/40" /> OFF</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-orange-500/40" /> Done</span>
          <span>Click a week cell to cycle status.</span>
          {!isHost ? <span>Only hosts can edit or delete gems.</span> : null}
        </div>
      </div>
    </div>
  );
}
