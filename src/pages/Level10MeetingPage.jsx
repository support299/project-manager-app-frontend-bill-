import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Clock,
  Users,
  UserCog,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Circle,
  X,
  Search,
  Folder,
  Phone,
  Calendar,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetLevel10MeetingStateQuery,
  useUpsertLevel10TimerMutation,
  useCreateLevel10SegueMutation,
  useUpdateLevel10SegueMutation,
  useDeleteLevel10SegueMutation,
  useCreateLevel10MeasurableMutation,
  useUpdateLevel10MeasurableMutation,
  useDeleteLevel10MeasurableMutation,
  useUpsertLevel10MeasurableValueMutation,
  useCreateLevel10RockMutation,
  useUpdateLevel10RockMutation,
  useDeleteLevel10RockMutation,
  useUpsertLevel10RockStatusMutation,
  useCreateLevel10RockNoteMutation,
  useDeleteLevel10RockNoteMutation,
  useCreateLevel10HeadlineMutation,
  useDeleteLevel10HeadlineMutation,
  useCreateLevel10IssueMutation,
  useUpdateLevel10IssueMutation,
  useDeleteLevel10IssueMutation,
  useUpsertLevel10RatingMutation,
} from "@/api/level10Api.js";
import { useGetGhlUsersQuery } from "@/api/locationsApi.js";
import { useGetTasksQuery } from "@/api/tasksApi.js";
import { useGetProjectsQuery } from "@/api/projectsApi.js";
import { getIdentity, setIdentity } from "@/utils/session.js";
import { useSession } from "@/hooks/useSession.js";
import { fmt, resolveAssigneeFromOwner, resolveMeetingHost } from "@/utils/level10.js";
import { NewTaskDialog } from "@/components/NewTaskDialog.jsx";
import { TaskDetail } from "@/components/TaskDetail.jsx";
import { STATUSES, STATUS_LABEL, PRIORITIES, PRIORITY_LABEL } from "@/theme/status.js";
import { useCustomStatuses } from "@/hooks/useCustomStatuses.js";
import { Button } from "@/components/ui/Button.jsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs.jsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog.jsx";
import { Input } from "@/components/ui/Input.jsx";
import { Textarea } from "@/components/ui/Textarea.jsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select.jsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover.jsx";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/Command.jsx";
import { Checkbox } from "@/components/ui/Checkbox.jsx";

const AGENDA_TABS = [
  { value: "segue", label: "Segue" },
  { value: "scorecard", label: "Scorecard" },
  { value: "rock-review", label: "Rock Review" },
  { value: "headlines", label: "Headlines" },
  { value: "issue-solver", label: "Issue Solver" },
  { value: "todo-review", label: "To-Do Review" },
  { value: "conclude", label: "Conclude" },
];

const ISSUE_STATUS_LABEL = {
  open: "Open",
  solved: "Solved",
  dropped: "Dropped",
};

const IDS_STAGES = [
  { value: "identify", label: "Identify" },
  { value: "discuss", label: "Discuss" },
  { value: "solve", label: "Solve" },
];

const DECIPHER_OPTIONS = [
  { value: "clarity", label: "Decipher", hint: "To help with clarity — needs more information before deciding next steps." },
  { value: "issue", label: "Issue", hint: "A problem to solve — e.g. We are not getting enough clients." },
  { value: "task", label: "Task", hint: "A single action item — e.g. Send Josh a CRM payment." },
  { value: "rock", label: "Rock", hint: "A 90-day priority — e.g. Sign 10 clients in 10 days." },
];

function formatMeetingDate(occurrenceKey) {
  if (!occurrenceKey || occurrenceKey === "default") return "—";
  const d = new Date(occurrenceKey);
  return Number.isNaN(d.getTime()) ? occurrenceKey : d.toLocaleDateString();
}

const ALL = "__all__";
const NONE = "__none__";

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

export function Level10MeetingPage() {
  const { eventId } = useParams();
  const [searchParams] = useSearchParams();
  const occ = searchParams.get("occ");
  const occurrenceKey = occ || "default";
  const session = useSession();

  useEffect(() => {
    if (session.name || session.email) {
      setIdentity({ name: session.name, email: session.email });
    }
  }, [session.name, session.email]);

  const { data: meetingState, isLoading: loading } = useGetLevel10MeetingStateQuery(
    { eventId, occurrence_key: occurrenceKey },
    { pollingInterval: 3000 },
  );

  const event = meetingState?.event ?? null;
  const timer = meetingState?.timer ?? null;
  const segues = meetingState?.segues ?? [];
  const measurables = meetingState?.measurables ?? [];
  const mValues = meetingState?.measurable_values ?? [];
  const rocks = meetingState?.rocks ?? [];
  const rockStatuses = meetingState?.rock_statuses ?? [];
  const rockNotes = meetingState?.rock_notes ?? [];
  const headlines = meetingState?.headlines ?? [];
  const ratings = meetingState?.ratings ?? [];
  const issues = meetingState?.issues ?? [];

  const locId = event?.location_id ?? null;
  const { data: usersData } = useGetGhlUsersQuery(
    locId ? { location_id: locId } : undefined,
    { skip: !locId },
  );
  const users = useMemo(
    () => (usersData?.users ?? []).map((u) => ({
      ghl_id: u.ghl_id ?? u.id,
      name: u.name ?? null,
      email: u.email ?? null,
    })),
    [usersData],
  );

  const [, force] = useState(0);
  const tickRef = useRef(null);
  const [agendaTab, setAgendaTab] = useState("segue");
  const [postOpen, setPostOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [upsertTimer] = useUpsertLevel10TimerMutation();
  const [deleteSegue] = useDeleteLevel10SegueMutation();

  useEffect(() => {
    if (timer?.status === "running") {
      tickRef.current = setInterval(() => force((x) => x + 1), 250);
      return () => { if (tickRef.current) clearInterval(tickRef.current); };
    }
    return undefined;
  }, [timer?.status]);

  const durationMs = useMemo(() => {
    const dm = event?.duration_minutes
      ?? (event?.ends_at ? Math.max(1, Math.round((new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime()) / 60000)) : 60);
    return dm * 60_000;
  }, [event]);

  const elapsedMs = useMemo(() => {
    if (!timer) return 0;
    let base = Number(timer.elapsed_ms) || 0;
    if (timer.status === "running" && timer.started_at) {
      base += Date.now() - new Date(timer.started_at).getTime();
    }
    return base;
  }, [timer, timer?.status === "running" ? Date.now() : 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const remaining = Math.max(0, durationMs - elapsedMs);
  const status = timer?.status || "idle";

  async function upsertTimerPatch(patch) {
    try {
      await upsertTimer({
        eventId,
        occurrence_key: occurrenceKey,
        duration_minutes: Math.round(durationMs / 60000),
        status: timer?.status || "idle",
        elapsed_ms: timer?.elapsed_ms || 0,
        started_at: timer?.started_at || null,
        ...patch,
      }).unwrap();
    } catch (err) {
      toast.error(apiError(err, "Failed to update timer"));
    }
  }

  async function onStart() {
    await upsertTimerPatch({ status: "running", started_at: new Date().toISOString() });
  }
  async function onPause() {
    if (!timer || timer.status !== "running" || !timer.started_at) return;
    const addMs = Date.now() - new Date(timer.started_at).getTime();
    await upsertTimerPatch({
      status: "paused",
      started_at: null,
      elapsed_ms: (Number(timer.elapsed_ms) || 0) + addMs,
    });
  }
  async function onResume() {
    await upsertTimerPatch({ status: "running", started_at: new Date().toISOString() });
  }
  async function onReset() {
    await upsertTimerPatch({ status: "idle", started_at: null, elapsed_ms: 0 });
  }

  const hostIds = useMemo(() => {
    if (!event) return [];
    if (event.host_ghl_user_ids?.length > 0) return event.host_ghl_user_ids;
    return event.host_ghl_user_id ? [event.host_ghl_user_id] : [];
  }, [event]);

  const attendeeIds = useMemo(() => {
    if (!event) return [];
    const set = new Set(event.participant_ghl_user_ids || []);
    for (const h of hostIds) set.add(h);
    return Array.from(set);
  }, [event, hostIds]);

  function userLabel(id) {
    const u = users.find((x) => x.ghl_id === id);
    return u?.name || u?.email || id;
  }

  const identity = getIdentity();
  const identityKey = session.ghlUserId || identity?.email || identity?.name || null;

  const isHost = useMemo(
    () => resolveMeetingHost({
      hostIds,
      session: {
        ghlUserId: session.ghlUserId,
        name: session.name,
        email: session.email,
        isSuperAdmin: session.isSuperAdmin,
      },
      users,
    }),
    [hostIds, session.ghlUserId, session.name, session.email, session.isSuperAdmin, users],
  );

  function canModify(s) {
    if (identityKey && s.author_identity && s.author_identity === identityKey) return true;
    if (session.name && s.author_name === session.name) return true;
    if (identity?.name && s.author_name === identity.name) return true;
    if (isHost) return true;
    return false;
  }

  async function handleDelete(s) {
    if (!confirm("Delete this segue post?")) return;
    try {
      await deleteSegue({ eventId, segueId: s.id, occurrence_key: occurrenceKey }).unwrap();
      toast.success("Segue deleted");
    } catch (err) {
      toast.error(apiError(err, "Failed to delete segue"));
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/level10">
            <Button variant="ghost" size="sm" className="h-9"><ArrowLeft className="h-4 w-4 mr-1.5" />Back</Button>
          </Link>
          <h1 className="text-lg font-semibold">Meeting Timer</h1>
        </div>

        <div className="max-w-[1600px] mx-auto px-4 pb-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Meeting</div>
              <h2 className="text-xl font-bold">{event?.title || (loading ? "Loading…" : "—")}</h2>
            </div>
            <div className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {event ? Math.round(durationMs / 60000) : "—"} min
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`text-3xl font-mono font-bold tabular-nums ${remaining === 0 && status !== "idle" ? "text-destructive" : ""}`}>
              {fmt(status === "idle" ? durationMs : remaining)}
            </div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground w-14 text-right">
              {status === "running" ? "Running" : status === "paused" ? "Paused" : "Ready"}
            </div>
            {status === "idle" && (
              <Button size="sm" onClick={onStart}><Play className="h-4 w-4 mr-1.5" />Start</Button>
            )}
            {status === "running" && (
              <>
                <Button size="sm" variant="secondary" onClick={onPause}><Pause className="h-4 w-4 mr-1.5" />Pause</Button>
                <Button size="sm" variant="outline" onClick={onReset}><RotateCcw className="h-4 w-4 mr-1.5" />Reset</Button>
              </>
            )}
            {status === "paused" && (
              <>
                <Button size="sm" onClick={onResume}><Play className="h-4 w-4 mr-1.5" />Resume</Button>
                <Button size="sm" variant="outline" onClick={onReset}><RotateCcw className="h-4 w-4 mr-1.5" />Reset</Button>
              </>
            )}
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto px-4 pb-3 text-[11px] text-muted-foreground">
          Live — anyone viewing this meeting sees the timer in real time.
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-3">
            <h3 className="font-medium mb-3">Meeting Agenda</h3>
            <Tabs value={agendaTab} onValueChange={setAgendaTab} orientation="vertical">
              <TabsList className="flex flex-col h-auto w-full bg-muted/40 p-1 gap-1">
                {AGENDA_TABS.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} className="w-full justify-start data-[state=active]:bg-background">
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="rounded-lg border bg-card p-3">
            <h3 className="font-medium mb-3">People</h3>
            {session.ghlUserId || session.name || session.email ? (
              <div className={`mb-3 text-xs px-2.5 py-1.5 rounded-md ${isHost ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                You are logged in as <span className="font-medium">{session.name || session.email || "User"}</span>
                {" · "}
                <span className="font-medium">{isHost ? "Host" : "Participant"}</span>
              </div>
            ) : (
              <div className="mb-3 text-xs px-2.5 py-1.5 rounded-md bg-amber-500/10 text-amber-800 dark:text-amber-200">
                Sign in via GHL to identify your role. Host-only controls are hidden until then.
              </div>
            )}
            <div className="space-y-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
                  <UserCog className="h-3 w-3" />Meeting Hosts
                </div>
                {hostIds.length === 0 ? (
                  <div className="text-sm text-muted-foreground">—</div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {hostIds.map((id) => (
                      <span key={id} className="text-xs px-2 py-0.5 rounded-full bg-primary/10">{userLabel(id)}</span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Users className="h-3 w-3" />Attendees
                </div>
                {attendeeIds.length === 0 ? (
                  <div className="text-sm text-muted-foreground">—</div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {attendeeIds.map((id) => (
                      <span key={id} className="text-xs px-2 py-0.5 rounded-full bg-muted">{userLabel(id)}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card min-h-[400px]">
          {agendaTab === "segue" ? (
            <SeguePanel
              segues={segues}
              canModify={canModify}
              onPostClick={() => { setEditing(null); setPostOpen(true); }}
              onEdit={(s) => { setEditing(s); setPostOpen(true); }}
              onDelete={handleDelete}
            />
          ) : agendaTab === "scorecard" ? (
            <ScorecardPanel
              eventId={eventId}
              occurrenceKey={occurrenceKey}
              measurables={measurables}
              values={mValues}
              isHost={isHost}
              users={users}
            />
          ) : agendaTab === "rock-review" ? (
            <RockReviewPanel
              eventId={eventId}
              occurrenceKey={occurrenceKey}
              rocks={rocks}
              statuses={rockStatuses}
              rockNotes={rockNotes}
              isHost={isHost}
              users={users}
              session={session}
              identityKey={identityKey}
            />
          ) : agendaTab === "headlines" ? (
            <HeadlinesPanel eventId={eventId} occurrenceKey={occurrenceKey} headlines={headlines} />
          ) : agendaTab === "issue-solver" ? (
            <IssueSolverPanel
              eventId={eventId}
              occurrenceKey={occurrenceKey}
              issues={issues}
              isHost={isHost}
              users={users}
              locationId={locId}
              session={session}
            />
          ) : agendaTab === "todo-review" ? (
            <TodoReviewPanel locationId={locId} users={users} session={session} />
          ) : agendaTab === "conclude" ? (
            <ConcludePanel eventId={eventId} occurrenceKey={occurrenceKey} ratings={ratings} />
          ) : (
            <div className="p-8 text-sm text-muted-foreground">
              {AGENDA_TABS.find((t) => t.value === agendaTab)?.label} — coming soon.
            </div>
          )}
        </div>
      </div>

      <PostSegueDialog
        open={postOpen}
        onOpenChange={(o) => { setPostOpen(o); if (!o) setEditing(null); }}
        eventId={eventId}
        occurrenceKey={occurrenceKey}
        editing={editing}
      />
    </div>
  );
}

function SeguePanel({ segues, canModify, onPostClick, onEdit, onDelete }) {
  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Segue</h2>
          <p className="text-sm text-muted-foreground mt-1">Good news — personal & professional · 5 minutes</p>
        </div>
        <Button onClick={onPostClick}><Plus className="h-4 w-4 mr-1.5" />Post a Segue</Button>
      </div>
      <div className="mt-5 rounded-lg border bg-muted/30 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Share your good news</div>
        {segues.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">No segues posted yet. Be the first to share!</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {segues.map((s) => (
              <div key={s.id} className="rounded-md border bg-card p-3 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-semibold text-primary">{s.author_name}</div>
                  {canModify(s) && (
                    <div className="flex items-center gap-1 -mr-1 -mt-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(s)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(s)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="text-sm whitespace-pre-wrap text-foreground/90">{s.body}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PostSegueDialog({ open, onOpenChange, eventId, occurrenceKey, editing }) {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [createSegue] = useCreateLevel10SegueMutation();
  const [updateSegue] = useUpdateLevel10SegueMutation();

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.author_name);
      setBody(editing.body);
    } else {
      const id = getIdentity();
      setName(id?.name || "");
      setBody("");
    }
  }, [open, editing]);

  async function submit() {
    const n = name.trim();
    const b = body.trim();
    if (!n) return toast.error("Please enter your name");
    if (!b) return toast.error("Please enter a description");
    setSaving(true);
    const identityKey = (() => {
      const id = getIdentity();
      return id?.email || id?.name || n;
    })();
    const existing = getIdentity();
    if (!existing || existing.name !== n) {
      setIdentity({ name: n, email: existing?.email });
    }
    try {
      if (editing) {
        await updateSegue({
          eventId,
          segueId: editing.id,
          occurrence_key: occurrenceKey,
          author_name: n,
          body: b,
        }).unwrap();
        toast.success("Segue updated");
      } else {
        await createSegue({
          eventId,
          occurrence_key: occurrenceKey,
          author_name: n,
          author_identity: identityKey,
          body: b,
        }).unwrap();
        toast.success("Segue posted");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(apiError(err, "Failed to save segue"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit segue" : "Post a segue"}</DialogTitle>
          <DialogDescription>Share your good news — personal or professional.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Your name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share what's going well…" rows={5} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{editing ? "Save changes" : "Post segue"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScorecardPanel({ eventId, occurrenceKey, measurables, values, isHost, users }) {
  const [newName, setNewName] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editGoal, setEditGoal] = useState("");
  const [editName, setEditName] = useState("");
  const [editOwner, setEditOwner] = useState("");

  const [createMeasurable] = useCreateLevel10MeasurableMutation();
  const [updateMeasurable] = useUpdateLevel10MeasurableMutation();
  const [deleteMeasurableMut] = useDeleteLevel10MeasurableMutation();
  const [upsertValue] = useUpsertLevel10MeasurableValueMutation();

  const valueByMeasurable = useMemo(() => {
    const m = new Map();
    for (const v of values) m.set(v.measurable_id, v);
    return m;
  }, [values]);

  async function addMeasurable() {
    const name = newName.trim();
    if (!name) return toast.error("Measurable name is required");
    const goalNum = newGoal.trim() === "" ? null : Number(newGoal);
    if (goalNum !== null && Number.isNaN(goalNum)) return toast.error("Goal must be a number");
    setAdding(true);
    try {
      await createMeasurable({
        eventId,
        occurrence_key: occurrenceKey,
        name,
        owner: newOwner.trim() || null,
        goal: goalNum,
        sort_order: measurables.length,
      }).unwrap();
      setNewName("");
      setNewOwner("");
      setNewGoal("");
      toast.success("Measurable added");
    } catch (err) {
      toast.error(apiError(err, "Failed to add measurable"));
    } finally {
      setAdding(false);
    }
  }

  async function setActual(m, raw) {
    const num = raw.trim() === "" ? null : Number(raw);
    if (num !== null && Number.isNaN(num)) return toast.error("Actual must be a number");
    try {
      await upsertValue({
        eventId,
        measurableId: m.id,
        occurrence_key: occurrenceKey,
        actual: num,
      }).unwrap();
    } catch (err) {
      toast.error(apiError(err, "Failed to update actual"));
    }
  }

  function startEdit(m) {
    setEditingId(m.id);
    setEditName(m.name);
    setEditOwner(m.owner || "");
    setEditGoal(m.goal == null ? "" : String(m.goal));
  }

  async function saveEdit(m) {
    if (!isHost) return toast.error("Only meeting hosts can edit measurables");
    const goalNum = editGoal.trim() === "" ? null : Number(editGoal);
    if (goalNum !== null && Number.isNaN(goalNum)) return toast.error("Goal must be a number");
    try {
      await updateMeasurable({
        eventId,
        measurableId: m.id,
        occurrence_key: occurrenceKey,
        name: editName.trim() || m.name,
        owner: editOwner.trim() || null,
        goal: goalNum,
      }).unwrap();
      setEditingId(null);
      toast.success("Measurable updated");
    } catch (err) {
      toast.error(apiError(err, "Failed to update measurable"));
    }
  }

  async function deleteMeasurable(m) {
    if (!isHost) return toast.error("Only meeting hosts can delete measurables");
    if (!confirm(`Delete measurable "${m.name}"? This removes it from all occurrences.`)) return;
    try {
      await deleteMeasurableMut({ eventId, measurableId: m.id, occurrence_key: occurrenceKey }).unwrap();
      toast.success("Measurable deleted");
    } catch (err) {
      toast.error(apiError(err, "Failed to delete measurable"));
    }
  }

  function statusFor(m, v) {
    if (!v || v.actual == null || m.goal == null) return "none";
    return v.actual >= m.goal ? "on" : "off";
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <h2 className="text-2xl font-bold tracking-tight">Scorecard</h2>
        <p className="text-sm text-muted-foreground mt-1">Review weekly measurables · 5 minutes</p>
      </div>
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Weekly Measurables</div>
        <div className="hidden md:grid grid-cols-[2fr_1fr_0.7fr_1fr_1fr_72px] gap-3 px-2 pb-2 text-xs uppercase tracking-wide text-muted-foreground">
          <div>Measurable</div>
          <div>Owner</div>
          <div>Goal</div>
          <div>Actual</div>
          <div>Status</div>
          {isHost && <div className="text-right">Actions</div>}
        </div>
        <div className="divide-y rounded-md border bg-card">
          {measurables.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">No measurables yet{isHost ? " — add one below" : ""}.</div>
          ) : (
            measurables.map((m) => {
              const v = valueByMeasurable.get(m.id);
              const st = statusFor(m, v);
              const isEditing = editingId === m.id;
              return (
                <div key={m.id} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_0.7fr_1fr_1fr_72px] gap-3 items-center px-3 py-3">
                  {isEditing ? (
                    <>
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                      <Input value={editOwner} onChange={(e) => setEditOwner(e.target.value)} placeholder="Owner" />
                      <Input value={editGoal} onChange={(e) => setEditGoal(e.target.value)} placeholder="Goal" inputMode="decimal" />
                    </>
                  ) : (
                    <>
                      <div className="font-medium">{m.name}</div>
                      <div className="text-sm text-foreground/80">{m.owner || "—"}</div>
                      <div className="text-sm">{m.goal == null ? "—" : m.goal}</div>
                    </>
                  )}
                  <Input
                    defaultValue={v?.actual == null ? "" : String(v.actual)}
                    key={`${m.id}-${v?.id || "new"}-${v?.actual ?? ""}`}
                    onBlur={(e) => {
                      const cur = v?.actual == null ? "" : String(v.actual);
                      if (e.target.value !== cur) setActual(m, e.target.value);
                    }}
                    placeholder="—"
                    inputMode="decimal"
                    className="text-center"
                  />
                  <div>
                    {st === "on" && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">✓ On</span>
                    )}
                    {st === "off" && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-destructive/15 text-destructive">✗ Off</span>
                    )}
                    {st === "none" && <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    {isHost && (isEditing ? (
                      <>
                        <Button size="sm" onClick={() => saveEdit(m)}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                      </>
                    ) : (
                      <>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(m)} title="Edit measurable">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMeasurable(m)} title="Delete measurable">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-[2fr_1fr_0.7fr_auto] gap-2">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Measurable name" />
          <Input value={newOwner} onChange={(e) => setNewOwner(e.target.value)} placeholder="Owner" list="scorecard-owners" />
          <datalist id="scorecard-owners">
            {users.map((u) => <option key={u.ghl_id} value={u.name || u.email || u.ghl_id} />)}
          </datalist>
          <Input value={newGoal} onChange={(e) => setNewGoal(e.target.value)} placeholder="Goal" inputMode="decimal" />
          <Button onClick={addMeasurable} disabled={adding}><Plus className="h-4 w-4 mr-1.5" />Add</Button>
        </div>
        {!isHost && (
          <p className="mt-3 text-xs text-muted-foreground">
            Anyone can add measurables and set actuals. Only meeting hosts can edit goals or delete measurables.
          </p>
        )}
      </div>
    </div>
  );
}

function rockDueInputValue(dueDate) {
  if (!dueDate) return "";
  return dueDate.slice(0, 10);
}

function formatRockDueDate(dueDate) {
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

function RockNotesSection({
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

function RockReviewPanel({ eventId, occurrenceKey, rocks, statuses, rockNotes, isHost, users, session, identityKey }) {
  const [newDesc, setNewDesc] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDesc, setEditDesc] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [editDueDate, setEditDueDate] = useState("");

  const [createRock] = useCreateLevel10RockMutation();
  const [updateRock] = useUpdateLevel10RockMutation();
  const [deleteRockMut] = useDeleteLevel10RockMutation();
  const [upsertRockStatus] = useUpsertLevel10RockStatusMutation();

  const statusByRock = useMemo(() => {
    const m = new Map();
    for (const s of statuses) m.set(s.rock_id, s);
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

  async function addRock() {
    const description = newDesc.trim();
    if (!description) return toast.error("Rock description is required");
    setAdding(true);
    try {
      await createRock({
        eventId,
        occurrence_key: occurrenceKey,
        description,
        owner: newOwner.trim() || null,
        due_date: newDueDate || null,
        sort_order: rocks.length,
      }).unwrap();
      setNewDesc("");
      setNewOwner("");
      setNewDueDate("");
      toast.success("Rock added");
    } catch (err) {
      toast.error(apiError(err, "Failed to add rock"));
    } finally {
      setAdding(false);
    }
  }

  async function cycleStatus(rock) {
    const cur = statusByRock.get(rock.id)?.status ?? "not_set";
    const next = cur === "not_set" ? "on_track" : cur === "on_track" ? "off_track" : "not_set";
    try {
      await upsertRockStatus({ eventId, rockId: rock.id, occurrence_key: occurrenceKey, status: next }).unwrap();
    } catch (err) {
      toast.error(apiError(err, "Failed to update rock status"));
    }
  }

  function startEdit(r) {
    setEditingId(r.id);
    setEditDesc(r.description);
    setEditOwner(r.owner || "");
    setEditDueDate(rockDueInputValue(r.due_date));
  }

  async function saveEdit(r) {
    if (!isHost) return toast.error("Only meeting hosts can edit rocks");
    try {
      await updateRock({
        eventId,
        rockId: r.id,
        occurrence_key: occurrenceKey,
        description: editDesc.trim() || r.description,
        owner: editOwner.trim() || null,
        due_date: editDueDate || null,
      }).unwrap();
      setEditingId(null);
      toast.success("Rock updated");
    } catch (err) {
      toast.error(apiError(err, "Failed to update rock"));
    }
  }

  async function deleteRock(r) {
    if (!isHost) return toast.error("Only meeting hosts can delete rocks");
    if (!confirm(`Delete rock "${r.description}"? This removes it from all occurrences.`)) return;
    try {
      await deleteRockMut({ eventId, rockId: r.id, occurrence_key: occurrenceKey }).unwrap();
      toast.success("Rock deleted");
    } catch (err) {
      toast.error(apiError(err, "Failed to delete rock"));
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <h2 className="text-2xl font-bold tracking-tight">Rock Review</h2>
        <p className="text-sm text-muted-foreground mt-1">Quarterly priorities on track? · 5 minutes</p>
      </div>
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Quarterly Rocks</div>
        <div className="space-y-2">
          {rocks.length === 0 ? (
            <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground text-center">No rocks yet — add one below.</div>
          ) : (
            rocks.map((r) => {
              const st = statusByRock.get(r.id)?.status ?? "not_set";
              const isEditing = editingId === r.id;
              const notes = notesByRock.get(r.id) ?? [];
              return (
                <div key={r.id} className={`rounded-md border bg-card overflow-hidden ${st === "on_track" ? "bg-emerald-500/5 border-emerald-500/30" : ""}`}>
                  <div className="px-4 py-3 flex items-start gap-3">
                    <button type="button" onClick={() => cycleStatus(r)} className="shrink-0 mt-0.5" aria-label="Toggle rock status">
                      {st === "on_track" ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : st === "off_track" ? <CheckCircle2 className="h-6 w-6 text-destructive" /> : <Circle className="h-6 w-6 text-muted-foreground" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-2">
                          <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Rock description" />
                          <Input value={editOwner} onChange={(e) => setEditOwner(e.target.value)} placeholder="Owner" />
                          <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
                        </div>
                      ) : (
                        <>
                          <div className="font-medium">{r.description}</div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                            <span>{r.owner || "No owner"}</span>
                            {r.due_date ? (
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                Due {formatRockDueDate(r.due_date)}
                              </span>
                            ) : null}
                          </div>
                        </>
                      )}
                    </div>
                    {!isEditing && (
                      <div className="shrink-0 flex flex-col items-end gap-2">
                        <div>
                          {st === "on_track" && <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">On Track</span>}
                          {st === "off_track" && <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-destructive/15 text-destructive">Off Track</span>}
                          {st === "not_set" && <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground">Not set</span>}
                        </div>
                        {isHost && (
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteRock(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        )}
                      </div>
                    )}
                    {isEditing && isHost && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" onClick={() => saveEdit(r)}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                      </div>
                    )}
                  </div>
                  {!isEditing ? (
                    <RockNotesSection
                      rockId={r.id}
                      notes={notes}
                      eventId={eventId}
                      occurrenceKey={occurrenceKey}
                      session={session}
                      identityKey={identityKey}
                      isHost={isHost}
                    />
                  ) : null}
                </div>
              );
            })
          )}
        </div>
        <div className="mt-3">
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-2">
            <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Rock description" />
            <Input value={newOwner} onChange={(e) => setNewOwner(e.target.value)} placeholder="Owner" list="rocks-owners" />
            <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
            <Button onClick={addRock} disabled={adding}><Plus className="h-4 w-4 mr-1.5" />Add</Button>
          </div>
          <datalist id="rocks-owners">{users.map((u) => <option key={u.ghl_id} value={u.name || u.email || u.ghl_id} />)}</datalist>
        </div>
        {!isHost && <p className="mt-3 text-xs text-muted-foreground">Anyone can add rocks and update status. Only meeting hosts can edit or delete rocks.</p>}
      </div>
    </div>
  );
}

function HeadlinesPanel({ eventId, occurrenceKey, headlines }) {
  const [kind, setKind] = useState("people");
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  const [createHeadline] = useCreateLevel10HeadlineMutation();
  const [deleteHeadlineMut] = useDeleteLevel10HeadlineMutation();

  async function addHeadline() {
    const t = text.trim();
    if (!t) return toast.error("Headline is required");
    setAdding(true);
    try {
      await createHeadline({ eventId, occurrence_key: occurrenceKey, kind, text: t }).unwrap();
      setText("");
    } catch (err) {
      toast.error(apiError(err, "Failed to add headline"));
    } finally {
      setAdding(false);
    }
  }

  async function removeHeadline(h) {
    try {
      await deleteHeadlineMut({ eventId, headlineId: h.id, occurrence_key: occurrenceKey }).unwrap();
    } catch (err) {
      toast.error(apiError(err, "Failed to delete headline"));
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <h2 className="text-2xl font-bold tracking-tight">Headlines</h2>
        <p className="text-sm text-muted-foreground mt-1">Customer & employee headlines · 5 minutes</p>
      </div>
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Customer & Employee Headlines</div>
        <div className="space-y-2">
          {headlines.length === 0 ? (
            <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground text-center">No headlines yet — add one below.</div>
          ) : (
            headlines.map((h) => (
              <div key={h.id} className="rounded-md border bg-card px-4 py-3 flex items-center gap-3">
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0 ${h.kind === "business" ? "bg-primary/10 text-primary" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}`}>
                  {h.kind === "business" ? "Business" : "People"}
                </span>
                <div className="flex-1 min-w-0 text-sm">{h.text}</div>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeHeadline(h)} title="Delete headline">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-[160px_1fr_auto] gap-2">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="people">People</SelectItem>
              <SelectItem value="business">Business</SelectItem>
            </SelectContent>
          </Select>
          <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addHeadline(); }} placeholder="Headline…" />
          <Button onClick={addHeadline} disabled={adding}><Plus className="h-4 w-4 mr-1.5" />Add</Button>
        </div>
      </div>
    </div>
  );
}

function IssueSolverPanel({ eventId, occurrenceKey, issues, isHost, users, locationId, session }) {
  const [newDesc, setNewDesc] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [newDecipher, setNewDecipher] = useState("");
  const [adding, setAdding] = useState(false);
  const [showSolved, setShowSolved] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDesc, setEditDesc] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [issueForTask, setIssueForTask] = useState(null);
  const [openTaskFromIssue, setOpenTaskFromIssue] = useState(false);

  const [createIssue] = useCreateLevel10IssueMutation();
  const [updateIssue] = useUpdateLevel10IssueMutation();
  const [deleteIssueMut] = useDeleteLevel10IssueMutation();
  const [createRock] = useCreateLevel10RockMutation();

  const locationParams = locationId ? { location_id: locationId } : {};
  const { data: projects = [] } = useGetProjectsQuery(locationParams, { skip: !locationId });

  const ownerOptions = useMemo(
    () => users.map((u) => u.name).filter(Boolean),
    [users],
  );

  const visibleIssues = useMemo(() => {
    const sorted = [...issues].sort((a, b) => {
      const order = { open: 0, solved: 1, dropped: 2 };
      const diff = (order[a.status] ?? 9) - (order[b.status] ?? 9);
      if (diff !== 0) return diff;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
    if (showSolved) return sorted;
    return sorted.filter((i) => i.status === "open");
  }, [issues, showSolved]);

  async function addIssue() {
    const description = newDesc.trim();
    if (!description) return toast.error("Issue description is required");
    setAdding(true);
    try {
      await createIssue({
        eventId,
        occurrence_key: occurrenceKey,
        description,
        owner: newOwner.trim() || null,
        raised_occurrence_key: occurrenceKey,
        decipher_type: newDecipher || null,
        sort_order: issues.length,
      }).unwrap();
      setNewDesc("");
      setNewOwner("");
      setNewDecipher("");
      toast.success("Issue added");
    } catch (err) {
      toast.error(apiError(err, "Failed to add issue"));
    } finally {
      setAdding(false);
    }
  }

  async function patchIssue(issue, patch) {
    try {
      await updateIssue({
        eventId,
        issueId: issue.id,
        occurrence_key: occurrenceKey,
        ...patch,
      }).unwrap();
    } catch (err) {
      toast.error(apiError(err, "Failed to update issue"));
    }
  }

  async function setIdsStage(issue, stage) {
    await patchIssue(issue, {
      ids_stage: issue.ids_stage === stage ? null : stage,
      status: issue.status === "solved" ? "open" : issue.status,
    });
  }

  async function setStatus(issue, status) {
    await patchIssue(issue, {
      status,
      solved_occurrence_key: status === "solved" ? occurrenceKey : null,
      ids_stage: status === "solved" ? "solve" : issue.ids_stage,
    });
    if (status === "solved") toast.success("Issue marked solved");
  }

  async function setDecipher(issue, decipher_type) {
    await patchIssue(issue, { decipher_type: decipher_type || null });
  }

  function startEdit(issue) {
    setEditingId(issue.id);
    setEditDesc(issue.description);
    setEditOwner(issue.owner || "");
  }

  async function saveEdit(issue) {
    await patchIssue(issue, {
      description: editDesc.trim() || issue.description,
      owner: editOwner.trim() || null,
    });
    setEditingId(null);
    toast.success("Issue updated");
  }

  async function removeIssue(issue) {
    if (!confirm(`Delete issue "${issue.description}"?`)) return;
    try {
      await deleteIssueMut({ eventId, issueId: issue.id, occurrence_key: occurrenceKey }).unwrap();
      toast.success("Issue deleted");
    } catch (err) {
      toast.error(apiError(err, "Failed to delete issue"));
    }
  }

  async function convertToTask(issue) {
    setIssueForTask(issue);
    setOpenTaskFromIssue(true);
  }

  async function handleTaskCreatedFromIssue() {
    if (!issueForTask) return;
    try {
      await setStatus(issueForTask, "solved");
    } catch {
      /* setStatus already toasts */
    }
    setIssueForTask(null);
  }

  const taskFromIssueInitial = useMemo(() => {
    if (!issueForTask) return null;
    const assignee = resolveAssigneeFromOwner(issueForTask.owner, users, session);
    return {
      title: issueForTask.description,
      description: "",
      assignee: assignee ? { id: assignee.id, name: assignee.name } : null,
    };
  }, [issueForTask, users, session]);

  async function convertToRock(issue) {
    try {
      await createRock({
        eventId,
        occurrence_key: occurrenceKey,
        description: issue.description,
        owner: issue.owner,
      }).unwrap();
      await setStatus(issue, "solved");
      toast.success("Created rock from issue");
    } catch (err) {
      toast.error(apiError(err, "Failed to create rock"));
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <h2 className="text-2xl font-bold tracking-tight">Issue Solver</h2>
        <p className="text-sm text-muted-foreground mt-1">
          IDS — Identify, Discuss, Solve · 60 minutes
        </p>
      </div>

      <div className="mb-4 rounded-lg border bg-muted/20 p-4 text-sm space-y-2">
        <div className="font-medium text-xs uppercase tracking-wider text-muted-foreground">Decipher framework</div>
        {DECIPHER_OPTIONS.map((d) => (
          <div key={d.value} className="flex gap-2">
            <span className="font-semibold shrink-0 w-16">{d.label}:</span>
            <span className="text-muted-foreground">{d.hint}</span>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Open Issues</div>
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox checked={showSolved} onCheckedChange={(v) => setShowSolved(!!v)} />
            Show solved & dropped
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 pr-3 font-semibold min-w-[200px]">Open Issue</th>
                <th className="pb-2 pr-3 font-semibold w-28">Owner</th>
                <th className="pb-2 pr-3 font-semibold w-28">Meeting Date</th>
                <th className="pb-2 pr-3 font-semibold w-24">Status</th>
                <th className="pb-2 pr-3 font-semibold min-w-[200px]">IDS</th>
                <th className="pb-2 pr-3 font-semibold w-32">Decipher</th>
                <th className="pb-2 font-semibold w-20" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleIssues.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No open issues — add one below.
                  </td>
                </tr>
              ) : (
                visibleIssues.map((issue) => {
                  const isEditing = editingId === issue.id;
                  const decipher = DECIPHER_OPTIONS.find((d) => d.value === issue.decipher_type);
                  return (
                    <tr key={issue.id} className={issue.status === "solved" ? "opacity-60" : ""}>
                      <td className="py-3 pr-3 align-top">
                        {isEditing ? (
                          <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
                        ) : (
                          <span className="font-medium">{issue.description}</span>
                        )}
                      </td>
                      <td className="py-3 pr-3 align-top">
                        {isEditing ? (
                          <Input value={editOwner} onChange={(e) => setEditOwner(e.target.value)} list="issue-owners" />
                        ) : (
                          issue.owner || "—"
                        )}
                      </td>
                      <td className="py-3 pr-3 align-top text-muted-foreground whitespace-nowrap">
                        {formatMeetingDate(issue.raised_occurrence_key)}
                      </td>
                      <td className="py-3 pr-3 align-top">
                        <Select value={issue.status} onValueChange={(v) => setStatus(issue, v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(ISSUE_STATUS_LABEL).map(([k, label]) => (
                              <SelectItem key={k} value={k}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-3 pr-3 align-top">
                        <div className="inline-flex rounded-md border bg-card p-0.5">
                          {IDS_STAGES.map((s) => (
                            <button
                              key={s.value}
                              type="button"
                              onClick={() => setIdsStage(issue, s.value)}
                              className={`px-2 py-1 text-[11px] rounded transition-colors ${
                                issue.ids_stage === s.value
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
                              }`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 pr-3 align-top">
                        <Select
                          value={issue.decipher_type || ""}
                          onValueChange={(v) => setDecipher(issue, v === "none" ? null : v)}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {DECIPHER_OPTIONS.map((d) => (
                              <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {decipher && (
                          <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{decipher.hint.split(" — ")[0]}</p>
                        )}
                      </td>
                      <td className="py-3 align-top">
                        <div className="flex flex-col gap-1">
                          {isEditing ? (
                            <>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => saveEdit(issue)}>Save</Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
                            </>
                          ) : (
                            <>
                              {issue.decipher_type === "task" && issue.status === "open" && (
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => convertToTask(issue)}>Create task</Button>
                              )}
                              {issue.decipher_type === "rock" && issue.status === "open" && (
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => convertToRock(issue)}>→ Rock</Button>
                              )}
                              {(isHost) && (
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(issue)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {isHost && (
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeIssue(issue)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <datalist id="issue-owners">
          {ownerOptions.map((name) => <option key={name} value={name} />)}
        </datalist>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-[2fr_1fr_140px_auto] gap-2">
          <Input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Open issue…"
            onKeyDown={(e) => { if (e.key === "Enter") addIssue(); }}
          />
          <Input
            value={newOwner}
            onChange={(e) => setNewOwner(e.target.value)}
            placeholder="Owner"
            list="issue-owners"
          />
          <Select value={newDecipher || "none"} onValueChange={(v) => setNewDecipher(v === "none" ? "" : v)}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Decipher" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Decipher type</SelectItem>
              {DECIPHER_OPTIONS.map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={addIssue} disabled={adding}><Plus className="h-4 w-4 mr-1.5" />Add</Button>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Anyone can add issues and work through IDS. Meeting date is set from this occurrence. Use Decipher to classify — convert Tasks and Rocks with the action buttons when ready to solve.
        </p>
      </div>

      <NewTaskDialog
        open={openTaskFromIssue}
        onOpenChange={(open) => {
          setOpenTaskFromIssue(open);
          if (!open) setIssueForTask(null);
        }}
        onCreated={handleTaskCreatedFromIssue}
        projects={projects}
        defaultLocationGhlId={locationId}
        initialValues={taskFromIssueInitial}
        dialogTitle="Create task from issue"
        dialogDescription="Review and complete the task details below. The issue will be marked solved when the task is created."
        submitLabel="Create task"
      />
    </div>
  );
}

function TodoReviewPanel({ locationId, users, session }) {
  const [stack, setStack] = useState([]);
  const activeId = stack[stack.length - 1] ?? null;
  const [openNew, setOpenNew] = useState(false);
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState(ALL);
  const [fPriority, setFPriority] = useState(ALL);
  const [fProject, setFProject] = useState(ALL);
  const [fAssignees, setFAssignees] = useState([]);
  const [fDueFrom, setFDueFrom] = useState("");
  const [fDueTo, setFDueTo] = useState("");

  const locationParams = locationId
    ? { location_id: locationId, meeting_todos: "true" }
    : {};
  const { data: tasks = [], isLoading: loading, refetch: refetchTasks } = useGetTasksQuery(
    locationParams,
    { skip: !locationId || !session.ghlLocationId },
  );
  const { data: projects = [], refetch: refetchProjects } = useGetProjectsQuery(locationParams, { skip: !locationId });
  const { statuses: customStatuses } = useCustomStatuses(locationId);

  const load = () => {
    refetchTasks();
    refetchProjects();
  };

  const filtersActive = fStatus !== ALL || fPriority !== ALL || fProject !== ALL || fAssignees.length > 0 || fDueFrom || fDueTo || q;
  function clearFilters() {
    setQ("");
    setFStatus(ALL);
    setFPriority(ALL);
    setFProject(ALL);
    setFAssignees([]);
    setFDueFrom("");
    setFDueTo("");
  }

  const grouped = useMemo(() => {
    const lower = q.toLowerCase();
    const filtered = tasks.filter((t) => {
      if (q && !(
        (t.title || "").toLowerCase().includes(lower) ||
        (t.description || "").toLowerCase().includes(lower) ||
        (t.ghl_assignee_name || "").toLowerCase().includes(lower) ||
        (t.ghl_contact_name || "").toLowerCase().includes(lower)
      )) return false;
      const eff = t.custom_status_key ? `custom:${t.custom_status_key}` : t.status;
      if (fStatus !== ALL && eff !== fStatus) return false;
      if (fPriority !== ALL && t.priority !== fPriority) return false;
      if (fProject !== ALL) {
        if (fProject === NONE && t.project_id) return false;
        if (fProject !== NONE && t.project_id !== fProject) return false;
      }
      if (fAssignees.length > 0) {
        const ids = t.ghl_assignee_ids ?? [];
        if (!fAssignees.some((a) => ids.includes(a))) return false;
      }
      if (fDueFrom && (!t.due_date || new Date(t.due_date) < new Date(fDueFrom))) return false;
      if (fDueTo && (!t.due_date || new Date(t.due_date) > new Date(fDueTo + "T23:59:59"))) return false;
      return true;
    });
    const map = {};
    for (const s of STATUSES) map[s] = [];
    for (const cs of customStatuses) map[`custom:${cs.key}`] = [];
    for (const t of filtered) {
      const key = t.custom_status_key ? `custom:${t.custom_status_key}` : t.status;
      (map[key] ||= []).push(t);
    }
    return map;
  }, [tasks, q, fStatus, fPriority, fProject, fAssignees, fDueFrom, fDueTo, customStatuses]);

  const allStatusKeys = useMemo(() => [...STATUSES, ...customStatuses.map((c) => `custom:${c.key}`)], [customStatuses]);
  const customByKey = useMemo(() => Object.fromEntries(customStatuses.map((c) => [`custom:${c.key}`, c])), [customStatuses]);
  const projectById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  const userOpts = useMemo(() => users.map((u) => ({ id: u.ghl_id, name: u.name || u.email || u.ghl_id })), [users]);

  return (
    <div className="p-6">
      <div className="mb-5 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">To-Do Review</h2>
          <p className="text-sm text-muted-foreground mt-1">Review and update tasks · 5 minutes</p>
        </div>
        <Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-1.5" />New task</Button>
      </div>
      <div className="space-y-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks…" className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              {customStatuses.map((cs) => <SelectItem key={cs.key} value={`custom:${cs.key}`}>{cs.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fPriority} onValueChange={setFPriority}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All priorities</SelectItem>
              {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fProject} onValueChange={setFProject}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Project" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All projects</SelectItem>
              <SelectItem value={NONE}>No project</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <UserIcon className="h-3.5 w-3.5 mr-1.5" />
                {fAssignees.length === 0 ? "Assignees" : `${fAssignees.length} user${fAssignees.length === 1 ? "" : "s"}`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-64">
              <Command>
                <CommandInput placeholder="Search users…" />
                <CommandList>
                  <CommandEmpty>No users.</CommandEmpty>
                  <CommandGroup>
                    {userOpts.map((u) => {
                      const checked = fAssignees.includes(u.id);
                      return (
                        <CommandItem key={u.id} onSelect={() => setFAssignees(checked ? fAssignees.filter((x) => x !== u.id) : [...fAssignees, u.id])}>
                          <Checkbox checked={checked} className="mr-2" />
                          {u.name}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                {fDueFrom || fDueTo ? "Due: set" : "Due date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-3 w-64 space-y-2">
              <div>
                <label className="text-xs text-muted-foreground">From</label>
                <Input type="date" value={fDueFrom} onChange={(e) => setFDueFrom(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">To</label>
                <Input type="date" value={fDueTo} onChange={(e) => setFDueTo(e.target.value)} />
              </div>
            </PopoverContent>
          </Popover>
          {filtersActive && (
            <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
              <X className="h-3.5 w-3.5 mr-1" />Clear
            </Button>
          )}
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : tasks.length === 0 ? (
        <div className="border border-dashed rounded-lg p-12 text-center">
          <p className="text-muted-foreground mb-4">No tasks yet.</p>
          <Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-1.5" />Create your first task</Button>
        </div>
      ) : (
        <div className="space-y-6">
          {allStatusKeys.map((s) => {
            const list = grouped[s] ?? [];
            if (list.length === 0) return null;
            const cs = customByKey[s];
            return (
              <section key={s}>
                <div className="flex items-center gap-2 mb-2">
                  {cs ? (
                    <span className="status-pill" style={{ background: `${cs.color}20`, color: cs.color }}>{cs.label}</span>
                  ) : (
                    <span className={`status-pill status-${s}`}>{STATUS_LABEL[s]}</span>
                  )}
                  <span className="text-xs text-muted-foreground">{list.length}</span>
                </div>
                <div className="border rounded-lg bg-card divide-y">
                  {list.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setStack([t.id])}
                      className={`w-full text-left px-4 py-3 hover:bg-accent/40 transition-colors flex items-center justify-between gap-3 priority-border-${t.priority}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{t.title}</div>
                        {t.description ? <div className="text-sm text-muted-foreground truncate">{t.description}</div> : null}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {t.project_id && projectById[t.project_id] && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px]">
                              <Folder className="h-3 w-3" />{projectById[t.project_id].title}
                            </span>
                          )}
                          {t.labels?.map((l) => (
                            <span key={l} className="rounded-full bg-accent px-2 py-0.5 text-[11px]">{l}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                        <span className="hidden sm:inline">{PRIORITY_LABEL[t.priority]}</span>
                        {(t.ghl_assignee_names?.length ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1"><UserIcon className="h-3 w-3" />{t.ghl_assignee_names.join(", ")}</span>
                        )}
                        {t.ghl_contact_name && (
                          <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{t.ghl_contact_name}</span>
                        )}
                        {t.due_date && (
                          <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(t.due_date).toLocaleDateString()}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <NewTaskDialog open={openNew} onOpenChange={setOpenNew} onCreated={load} projects={projects} defaultProjectId={fProject !== ALL && fProject !== NONE ? fProject : null} />
      <TaskDetail taskId={activeId} meetingAccess onClose={() => setStack([])} onChange={load} onOpenTask={(id) => setStack((s) => [...s, id])} onBack={stack.length > 1 ? () => setStack((s) => s.slice(0, -1)) : undefined} projects={projects} />
    </div>
  );
}

function ConcludePanel({ eventId, occurrenceKey, ratings }) {
  const [identityName, setIdentityName] = useState("");
  const [identityKey, setIdentityKey] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [pendingRating, setPendingRating] = useState(null);
  const [reasonDraft, setReasonDraft] = useState("");
  const [upsertRating] = useUpsertLevel10RatingMutation();

  useEffect(() => {
    const id = getIdentity();
    if (id?.name) {
      setIdentityName(id.name);
      setIdentityKey(id.email || id.name);
    }
  }, []);

  const myRating = useMemo(() => ratings.find((r) => r.rater_identity === identityKey), [ratings, identityKey]);

  const avg = useMemo(() => {
    if (ratings.length === 0) return null;
    const sum = ratings.reduce((a, r) => a + r.rating, 0);
    return Math.round((sum / ratings.length) * 10) / 10;
  }, [ratings]);

  const avgLabel = (() => {
    if (avg === null) return "Awaiting ratings…";
    const r = Math.round(avg);
    if (r >= 9) return `${avg}/10 — Excellent! 🎉`;
    if (r >= 7) return `${avg}/10 — Great meeting! 🎉`;
    if (r >= 5) return `${avg}/10 — Solid meeting`;
    if (r >= 3) return `${avg}/10 — Needs improvement`;
    return `${avg}/10 — Needs work`;
  })();

  async function submitRating(value, reason) {
    if (!identityName.trim()) {
      toast.error("Please enter your name first");
      return;
    }
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      toast.error("Please tell us why you gave this rating");
      return;
    }
    const name = identityName.trim();
    const key = identityKey || name;
    const existing = getIdentity();
    if (!existing || existing.name !== name) {
      setIdentity({ name, email: existing?.email });
    }
    try {
      await upsertRating({
        eventId,
        occurrence_key: occurrenceKey,
        rater_identity: key,
        rater_name: name,
        rating: value,
        reason: trimmedReason,
      }).unwrap();
      setPendingRating(null);
      setReasonDraft("");
    } catch (err) {
      toast.error(apiError(err, "Failed to submit rating"));
    }
  }

  function openRatingDialog(value) {
    setPendingRating(value);
    setReasonDraft(myRating?.rating === value ? (myRating.reason || "") : "");
  }

  function closeRatingDialog() {
    setPendingRating(null);
    setReasonDraft("");
  }

  function saveName() {
    const n = nameDraft.trim();
    if (!n) return;
    setIdentity({ name: n });
    setIdentityName(n);
    setIdentityKey(n);
    setNameDraft("");
  }

  const sortedRatings = useMemo(() => [...ratings].sort((a, b) => a.created_at.localeCompare(b.created_at)), [ratings]);

  return (
    <div className="p-6">
      <div className="mb-5">
        <h2 className="text-2xl font-bold tracking-tight">Conclude</h2>
        <p className="text-sm text-muted-foreground mt-1">Wrap-up, cascade & rating · 5 minutes</p>
      </div>
      <div className="rounded-lg border bg-muted/30 p-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Rate this meeting (1–10)</div>
        <div className="text-center">
          <div className="text-2xl font-bold text-primary mb-6">{avgLabel}</div>
          <div className="flex items-center justify-center flex-wrap gap-2 mb-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
              const isAvg = avg !== null && Math.round(avg) === n;
              return (
                <div key={n} className={`h-12 w-12 rounded-full border-2 flex items-center justify-center text-base font-semibold transition ${isAvg ? "bg-primary text-primary-foreground border-primary scale-110" : "border-border text-foreground bg-card"}`}>
                  {n}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between max-w-md mx-auto text-xs text-muted-foreground px-2">
            <span>Needs Work</span>
            <span>Excellent</span>
          </div>
        </div>
        {!identityName ? (
          <div className="mt-6 max-w-md mx-auto rounded-md border bg-card p-4">
            <label className="text-xs font-medium text-muted-foreground">Your name</label>
            <div className="flex gap-2 mt-1.5">
              <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="Enter your name to rate" onKeyDown={(e) => { if (e.key === "Enter") saveName(); }} />
              <Button onClick={saveName}>Save</Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 max-w-md mx-auto">
            <div className="text-xs text-muted-foreground text-center mb-2">
              Rating as <span className="font-medium text-foreground">{identityName}</span>
              {" · "}
              <button type="button" className="underline hover:text-foreground" onClick={() => { setIdentityName(""); setIdentityKey(""); }}>change</button>
            </div>
            <div className="flex items-center justify-center flex-wrap gap-1.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                const selected = myRating?.rating === n;
                return (
                  <button key={n} type="button" onClick={() => openRatingDialog(n)} className={`h-9 w-9 rounded-full border text-sm font-medium transition ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent border-border"}`}>
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {sortedRatings.length === 0 ? (
          <div className="col-span-full rounded-md border bg-card p-6 text-sm text-muted-foreground text-center">No ratings yet — be the first.</div>
        ) : (
          sortedRatings.map((r) => (
            <div key={r.id} className="rounded-lg border bg-muted/30 p-4">
              <div className="text-sm text-muted-foreground text-center mb-3">{r.rater_name}</div>
              <div className="flex items-center justify-center flex-wrap gap-1">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                  const selected = r.rating === n;
                  return (
                    <div key={n} className={`h-7 w-7 rounded-full border flex items-center justify-center text-xs ${selected ? "bg-primary text-primary-foreground border-primary" : "border-border/60 text-muted-foreground"}`}>
                      {n}
                    </div>
                  );
                })}
              </div>
              <div className="text-center text-3xl font-bold text-primary mt-3">{r.rating}</div>
              {r.reason ? (
                <p className="mt-3 text-sm text-muted-foreground text-center leading-relaxed">"{r.reason}"</p>
              ) : null}
            </div>
          ))
        )}
      </div>
      <Dialog open={pendingRating !== null} onOpenChange={(open) => { if (!open) closeRatingDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Why did you rate this meeting {pendingRating}/10?</DialogTitle>
            <DialogDescription>
              Share what went well or what could be improved. This helps the team run better meetings.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reasonDraft}
            onChange={(e) => setReasonDraft(e.target.value)}
            placeholder="Tell us why you gave this rating…"
            rows={4}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={closeRatingDialog}>Cancel</Button>
            <Button onClick={() => submitRating(pendingRating, reasonDraft)}>Submit rating</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}