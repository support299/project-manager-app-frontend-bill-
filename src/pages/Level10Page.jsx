import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  MapPin,
  Video,
  Calendar as CalIcon,
  Trash2,
  Repeat,
  Clock,
  Pencil,
  ExternalLink,
  Users,
  Check,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetLevel10EventsQuery,
  useCreateLevel10EventMutation,
  useUpdateLevel10EventMutation,
  useDeleteLevel10EventMutation,
  useAddLevel10ExceptionMutation,
} from "@/api/level10Api.js";
import { useGetLocationUsersQuery } from "@/api/locationsApi.js";
import { useSession } from "@/hooks/useSession.js";
import { useLocations } from "@/hooks/useLocations.js";
import { Button } from "@/components/ui/Button.jsx";
import { Input } from "@/components/ui/Input.jsx";
import { Label } from "@/components/ui/Label.jsx";
import { Textarea } from "@/components/ui/Textarea.jsx";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog.jsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select.jsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover.jsx";
import { Checkbox } from "@/components/ui/Checkbox.jsx";
import {
  BROWSER_TZ,
  TIMEZONES,
  toLocalInput,
  dateKey,
  expandEvent,
  recurrenceLabel,
} from "@/utils/level10.js";

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

export function Level10Page() {
  const session = useSession();
  const { locations, locked, lockedLocationRowId } = useLocations();
  const [selectedLocationRowId, setSelectedLocationRowId] = useState(null);

  useEffect(() => {
    if (locked && lockedLocationRowId) {
      setSelectedLocationRowId(lockedLocationRowId);
    } else if (!selectedLocationRowId && locations.length > 0) {
      setSelectedLocationRowId(locations[0].id);
    }
  }, [locked, lockedLocationRowId, locations, selectedLocationRowId]);

  const currentLoc = locations.find((l) => l.id === selectedLocationRowId);
  const locId = session.ghlLocationId || currentLoc?.location_id || null;
  const skip = !session.loaded || (session.locationLocked && !locId);
  const locationParams = locId ? { location_id: locId } : {};

  const { data: events = [], isLoading: loading, refetch } = useGetLevel10EventsQuery(
    locationParams,
    { skip: skip || !locId },
  );
  const { data: users = [] } = useGetLocationUsersQuery(selectedLocationRowId, {
    skip: !selectedLocationRowId,
  });

  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editOccurrenceDate, setEditOccurrenceDate] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedOccDate, setSelectedOccDate] = useState(null);
  const [scopePrompt, setScopePrompt] = useState(null);

  const [deleteEventMut] = useDeleteLevel10EventMutation();
  const [addExceptionMut] = useAddLevel10ExceptionMutation();

  useEffect(() => {
    if (events.length && !events.find((e) => e.id === selectedId)) {
      setSelectedId(events[0].id);
      setSelectedOccDate(new Date(events[0].starts_at));
    }
  }, [events, selectedId]);

  const monthLabel = calMonth.toLocaleString(undefined, { month: "long", year: "numeric" });
  const daysGrid = useMemo(() => {
    const first = new Date(calMonth);
    const startDow = first.getDay();
    const start = new Date(first);
    start.setDate(first.getDate() - startDow);
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push(d);
    }
    return cells;
  }, [calMonth]);

  const occurrencesByDay = useMemo(() => {
    const m = new Map();
    if (daysGrid.length === 0) return m;
    const rangeStart = new Date(daysGrid[0]);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(daysGrid[daysGrid.length - 1]);
    rangeEnd.setHours(23, 59, 59, 999);
    for (const e of events) {
      for (const occ of expandEvent(e, rangeStart, rangeEnd)) {
        const k = dateKey(occ.date);
        const arr = m.get(k) || [];
        arr.push(occ);
        m.set(k, arr);
      }
    }
    for (const arr of m.values()) arr.sort((a, b) => +a.date - +b.date);
    return m;
  }, [events, daysGrid]);

  const selected = events.find((e) => e.id === selectedId) || null;
  const selectedOccurrence = selected && selectedOccDate
    ? { date: selectedOccDate, label: selectedOccDate.toLocaleString([], { dateStyle: "full", timeStyle: "short" }) }
    : null;
  const isRecurring = selected ? selected.recurrence !== "none" : false;

  function startEdit() {
    if (!selected || !selectedOccDate) return;
    if (isRecurring) {
      setScopePrompt({ action: "edit", event: selected, occDate: selectedOccDate });
    } else {
      setEditing(selected);
      setEditOccurrenceDate(null);
      setOpenNew(true);
    }
  }

  function startDelete() {
    if (!selected || !selectedOccDate) return;
    if (isRecurring) {
      setScopePrompt({ action: "delete", event: selected, occDate: selectedOccDate });
    } else {
      void deleteSeries(selected.id);
    }
  }

  async function deleteSeries(id) {
    if (!confirm("Delete this event and all its repeats?")) return;
    try {
      await deleteEventMut(id).unwrap();
      toast.success("Event deleted");
      if (selectedId === id) {
        setSelectedId(null);
        setSelectedOccDate(null);
      }
      refetch();
    } catch (err) {
      toast.error(apiError(err, "Failed to delete event"));
    }
  }

  async function deleteOccurrence(ev, occDate) {
    try {
      await addExceptionMut({ eventId: ev.id, exception_date: occDate.toISOString() }).unwrap();
      toast.success("Occurrence deleted");
      setSelectedOccDate(null);
      refetch();
    } catch (err) {
      toast.error(apiError(err, "Failed to delete occurrence"));
    }
  }

  async function handleScopeChoice(scope) {
    if (!scopePrompt) return;
    const { action, event, occDate } = scopePrompt;
    setScopePrompt(null);
    if (action === "delete") {
      if (scope === "series") await deleteSeries(event.id);
      else await deleteOccurrence(event, occDate);
      return;
    }
    if (scope === "series") {
      setEditing(event);
      setEditOccurrenceDate(null);
      setOpenNew(true);
    } else {
      setEditing(event);
      setEditOccurrenceDate(occDate);
      setOpenNew(true);
    }
  }

  const openLink = selected
    ? `/level10/${selected.id}${selectedOccDate ? `?occ=${encodeURIComponent(selectedOccDate.toISOString())}` : ""}`
    : "#";

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center gap-3">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Video className="h-5 w-5" />Perfect 10 Meeting
          </h1>
          <div className="ml-auto flex items-center gap-2">
            {session.isSuperAdmin && !session.locationLocked && locations.length > 0 && (
              <Select value={selectedLocationRowId ?? ""} onValueChange={setSelectedLocationRowId}>
                <SelectTrigger className="h-9 w-[200px]">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              size="sm"
              onClick={() => {
                if (!locId) {
                  toast.error("Select a location before creating an event.");
                  return;
                }
                setEditing(null);
                setOpenNew(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1.5" />New Event
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">{monthLabel}</h2>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8" onClick={() => { const d = new Date(); setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>
                Today
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 text-xs text-muted-foreground mb-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="px-2 py-1 text-center">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {daysGrid.map((d, i) => {
              const inMonth = d.getMonth() === calMonth.getMonth();
              const k = dateKey(d);
              const dayOccs = occurrencesByDay.get(k) || [];
              const isToday = d.toDateString() === new Date().toDateString();
              return (
                <div key={i} className={`min-h-[96px] rounded border p-1.5 text-xs ${inMonth ? "bg-background" : "bg-muted/30 text-muted-foreground"}`}>
                  <div className={`text-right mb-1 ${isToday ? "font-bold text-primary" : ""}`}>{d.getDate()}</div>
                  <div className="space-y-1">
                    {dayOccs.slice(0, 3).map((occ) => {
                      const e = occ.event;
                      // Only this occurrence looks selected — not every repeat of the series.
                      const active = selectedId === e.id
                        && selectedOccDate
                        && dateKey(selectedOccDate) === dateKey(occ.date);
                      const sameSeries = selectedId === e.id && !active;
                      return (
                        <button
                          key={occ.key}
                          onClick={() => { setSelectedId(e.id); setSelectedOccDate(occ.date); }}
                          className={`w-full text-left px-1.5 py-1 rounded truncate flex items-center gap-1 ${
                            active
                              ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1 ring-offset-background"
                              : sameSeries
                                ? "bg-primary/15 hover:bg-primary/25 border border-primary/20"
                                : "bg-primary/10 hover:bg-primary/20"
                          }`}
                        >
                          {e.recurrence !== "none" ? <Repeat className="h-3 w-3 shrink-0" /> : (e.location_type === "online" ? <Video className="h-3 w-3 shrink-0" /> : <MapPin className="h-3 w-3 shrink-0" />)}
                          <span className="truncate">{occ.date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} {e.title}</span>
                        </button>
                      );
                    })}
                    {dayOccs.length > 3 && <div className="text-muted-foreground px-1">+{dayOccs.length - 3} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h2 className="font-medium flex items-center gap-2 mb-3"><CalIcon className="h-4 w-4" />Event Details</h2>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : !selected ? (
            <div className="text-sm text-muted-foreground">
              {events.length === 0 ? 'No events yet. Click "New Event" to add one.' : "Select an event from the calendar to view its details."}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Title</div>
                <div className="text-base font-semibold">{selected.title}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />When
                </div>
                <div className="text-sm">
                  {selectedOccurrence ? selectedOccurrence.label : new Date(selected.starts_at).toLocaleString([], { dateStyle: "full", timeStyle: "short" })}
                </div>
                {isRecurring && <div className="text-xs text-muted-foreground">Selected occurrence of a repeating event</div>}
                {selected.duration_minutes != null && (
                  <div className="text-sm text-muted-foreground">Duration: {selected.duration_minutes} min</div>
                )}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                  <Repeat className="h-3 w-3" />Recurrence
                </div>
                <div className="text-sm">{recurrenceLabel(selected)}</div>
                {selected.recurrence !== "none" && selected.recurrence_until && (
                  <div className="text-xs text-muted-foreground">Until {new Date(selected.recurrence_until).toLocaleDateString()}</div>
                )}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                  {selected.location_type === "online" ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                  {selected.location_type === "online" ? "Online" : "In Person"}
                </div>
                {selected.location_value ? (
                  selected.location_type === "online" ? (
                    <a href={selected.location_value} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline inline-flex items-center gap-1 break-all">
                      {selected.location_value}<ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  ) : (
                    <div className="text-sm">{selected.location_value}</div>
                  )
                ) : (
                  <div className="text-sm text-muted-foreground">—</div>
                )}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Timezone</div>
                <div className="text-sm">{selected.timezone || BROWSER_TZ}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Hosts</div>
                {(() => {
                  const ids = (selected.host_ghl_user_ids?.length > 0)
                    ? selected.host_ghl_user_ids
                    : (selected.host_ghl_user_id ? [selected.host_ghl_user_id] : []);
                  if (ids.length === 0) return <div className="text-sm text-muted-foreground">—</div>;
                  return (
                    <div className="flex flex-wrap gap-1">
                      {ids.map((id) => {
                        const u = users.find((x) => x.ghl_id === id);
                        return <span key={id} className="text-xs px-2 py-0.5 rounded-full bg-primary/10">{u?.name || u?.email || id}</span>;
                      })}
                    </div>
                  );
                })()}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                  <Users className="h-3 w-3" />Participants
                </div>
                {selected.participant_ghl_user_ids?.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {selected.participant_ghl_user_ids.map((id) => {
                      const u = users.find((x) => x.ghl_id === id);
                      return <span key={id} className="text-xs px-2 py-0.5 rounded-full bg-muted">{u?.name || u?.email || id}</span>;
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">—</div>
                )}
              </div>
              {selected.notes && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Notes</div>
                  <div className="text-sm whitespace-pre-wrap">{selected.notes}</div>
                </div>
              )}
              <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
                <Link to={openLink}>
                  <Button size="sm"><Play className="h-3.5 w-3.5 mr-1.5" />Open</Button>
                </Link>
                <Button size="sm" variant="outline" onClick={startEdit}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit
                </Button>
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={startDelete}>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <EventDialog
        open={openNew}
        onOpenChange={(o) => { setOpenNew(o); if (!o) { setEditing(null); setEditOccurrenceDate(null); } }}
        editing={editing}
        editOccurrenceDate={editOccurrenceDate}
        locId={locId}
        users={users}
        onSaved={() => refetch()}
      />

      <Dialog open={!!scopePrompt} onOpenChange={(o) => { if (!o) setScopePrompt(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{scopePrompt?.action === "delete" ? "Delete repeating event" : "Edit repeating event"}</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            Apply this change to just the selected occurrence, or to the entire series?
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setScopePrompt(null)}>Cancel</Button>
            <Button variant="outline" onClick={() => handleScopeChoice("single")}>This event only</Button>
            <Button onClick={() => handleScopeChoice("series")}>All events in series</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventDialog({ open, onOpenChange, editing, editOccurrenceDate, locId, users, onSaved }) {
  const singleOccurrenceMode = !!(editing && editOccurrenceDate && editing.recurrence !== "none");
  const locationUserIds = useMemo(
    () => users.map((u) => u.ghl_id).filter(Boolean),
    [users],
  );
  const [title, setTitle] = useState("");
  const [locType, setLocType] = useState("inperson");
  const [locValue, setLocValue] = useState("");
  const [startsAt, setStartsAt] = useState(() => toLocalInput(new Date()));
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [notes, setNotes] = useState("");
  const [recurrence, setRecurrence] = useState("none");
  const [interval, setIntervalN] = useState(1);
  const [recurrenceUntil, setRecurrenceUntil] = useState("");
  const [timezone, setTimezone] = useState(BROWSER_TZ);
  const [hosts, setHosts] = useState([]);
  const [saving, setSaving] = useState(false);

  const [createEvent] = useCreateLevel10EventMutation();
  const [updateEvent] = useUpdateLevel10EventMutation();

  useEffect(() => {
    if (open) {
      if (editing) {
        setTitle(editing.title);
        setLocType(editing.location_type);
        setLocValue(editing.location_value || "");
        setStartsAt(toLocalInput(editOccurrenceDate || new Date(editing.starts_at)));
        const dm = editing.duration_minutes
          ?? (editing.ends_at ? Math.max(1, Math.round((new Date(editing.ends_at).getTime() - new Date(editing.starts_at).getTime()) / 60000)) : 60);
        setDurationMinutes(dm);
        setNotes(editing.notes || "");
        setRecurrence(editOccurrenceDate ? "none" : (editing.recurrence || "none"));
        setIntervalN(editing.recurrence_interval || 1);
        setRecurrenceUntil(editing.recurrence_until ? editing.recurrence_until.slice(0, 10) : "");
        setTimezone(editing.timezone || BROWSER_TZ);
        setHosts(
          (editing.host_ghl_user_ids?.length > 0)
            ? editing.host_ghl_user_ids
            : (editing.host_ghl_user_id ? [editing.host_ghl_user_id] : []),
        );
      } else {
        setTitle("");
        setLocType("inperson");
        setLocValue("");
        setStartsAt(toLocalInput(new Date()));
        setDurationMinutes(60);
        setNotes("");
        setRecurrence("none");
        setIntervalN(1);
        setRecurrenceUntil("");
        setTimezone(BROWSER_TZ);
        setHosts([]);
      }
    }
  }, [open, editing, editOccurrenceDate]);

  async function save() {
    if (!title.trim()) return toast.error("Title is required");
    if (!startsAt) return toast.error("Start date/time is required");
    if (!locId) return toast.error("Select a location before saving.");
    if (hosts.length === 0) return toast.error("At least one meeting host is required");
    if (locationUserIds.length === 0) return toast.error("No users found for this location. Sync users in Admin first.");
    setSaving(true);
    const finalParticipants = Array.from(new Set([...locationUserIds, ...hosts]));
    const payload = {
      title: title.trim(),
      location_type: locType,
      location_value: locValue.trim() || null,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: durationMinutes > 0 ? new Date(new Date(startsAt).getTime() + durationMinutes * 60000).toISOString() : null,
      duration_minutes: durationMinutes > 0 ? Math.round(durationMinutes) : null,
      notes: notes.trim() || null,
      location_id: locId,
      recurrence,
      recurrence_interval: recurrence === "custom" ? Math.max(1, interval) : 1,
      recurrence_until: recurrence !== "none" && recurrenceUntil ? new Date(recurrenceUntil + "T23:59:59").toISOString() : null,
      timezone: timezone || null,
      participant_ghl_user_ids: finalParticipants,
      host_ghl_user_id: hosts[0],
      host_ghl_user_ids: hosts,
    };
    try {
      if (singleOccurrenceMode && editing && editOccurrenceDate) {
        await updateEvent({
          eventId: editing.id,
          single_occurrence_mode: true,
          edit_occurrence_date: editOccurrenceDate.toISOString(),
          ...payload,
          recurrence: "none",
          recurrence_interval: 1,
          recurrence_until: null,
        }).unwrap();
      } else if (editing) {
        await updateEvent({ eventId: editing.id, ...payload }).unwrap();
      } else {
        await createEvent(payload).unwrap();
      }
      toast.success(editing ? "Event updated" : "Event added");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(apiError(err, "Failed to save event"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? (singleOccurrenceMode ? "Edit this occurrence" : "Edit Event") : "New Event"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {singleOccurrenceMode && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 px-3 py-2 text-xs">
              Changes will apply only to this single occurrence. The rest of the series stays unchanged.
            </div>
          )}
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekly Perfect 10 Meeting" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Starts</Label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div>
              <Label>Duration (minutes)</Label>
              <Input type="number" min={1} value={durationMinutes} onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 0)} />
            </div>
          </div>
          <div className="text-xs text-muted-foreground -mt-2">
            Ends at: {startsAt && durationMinutes > 0 ? new Date(new Date(startsAt).getTime() + durationMinutes * 60000).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—"}
          </div>
          <div>
            <Label>Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!singleOccurrenceMode && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Repeat</Label>
                  <Select value={recurrence} onValueChange={setRecurrence}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Does not repeat</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Every 2 weeks</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="custom">Custom (every N weeks)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {recurrence === "custom" && (
                  <div>
                    <Label>Every N weeks</Label>
                    <Input type="number" min={1} value={interval} onChange={(e) => setIntervalN(parseInt(e.target.value, 10) || 1)} />
                  </div>
                )}
                {recurrence !== "none" && recurrence !== "custom" && (
                  <div>
                    <Label>Repeat until (optional)</Label>
                    <Input type="date" value={recurrenceUntil} onChange={(e) => setRecurrenceUntil(e.target.value)} />
                  </div>
                )}
              </div>
              {recurrence === "custom" && (
                <div>
                  <Label>Repeat until (optional)</Label>
                  <Input type="date" value={recurrenceUntil} onChange={(e) => setRecurrenceUntil(e.target.value)} />
                </div>
              )}
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Location Type</Label>
              <Select value={locType} onValueChange={setLocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inperson">In Person</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{locType === "online" ? "Meeting URL" : "Address / Place"}</Label>
              <Input
                value={locValue}
                onChange={(e) => setLocValue(e.target.value)}
                placeholder={locType === "online" ? "https://zoom.us/j/..." : "Conference Room A"}
              />
            </div>
          </div>
          <div>
            <Label>Meeting Hosts <span className="text-destructive">*</span></Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" type="button" className="w-full justify-start font-normal">
                  {hosts.length === 0
                    ? <span className="text-muted-foreground">Select hosts…</span>
                    : <span className="truncate">{hosts.length} selected</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                <div className="max-h-64 overflow-y-auto p-1">
                  {users.length === 0 ? (
                    <div className="text-sm text-muted-foreground px-3 py-2">No users found for this location.</div>
                  ) : users.map((u) => {
                    const checked = hosts.includes(u.ghl_id);
                    return (
                      <label key={u.ghl_id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setHosts((prev) => (v ? [...prev, u.ghl_id] : prev.filter((id) => id !== u.ghl_id)));
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate">{u.name || u.email || u.ghl_id}</div>
                          {u.name && u.email && <div className="text-xs text-muted-foreground truncate">{u.email}</div>}
                        </div>
                        {checked && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                      </label>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
            {hosts.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {hosts.map((id) => {
                  const u = users.find((x) => x.ghl_id === id);
                  return (
                    <span key={id} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 flex items-center gap-1">
                      {u?.name || u?.email || id}
                      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setHosts((prev) => prev.filter((x) => x !== id))}>×</button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <Label className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />Participants</Label>
            <p className="text-xs text-muted-foreground mt-1 mb-2">
              All users in this location are included automatically.
            </p>
            {users.length === 0 ? (
              <div className="text-sm text-muted-foreground rounded-md border px-3 py-2">
                No users found for this location.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1 rounded-md border bg-muted/20 px-3 py-2 max-h-32 overflow-y-auto">
                {users.map((u) => (
                  <span key={u.ghl_id} className="text-xs px-2 py-0.5 rounded-full bg-muted">
                    {u.name || u.email || u.ghl_id}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
