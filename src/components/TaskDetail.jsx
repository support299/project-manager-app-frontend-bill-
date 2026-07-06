import { useEffect, useMemo, useRef, useState } from "react";
import {
  useGetTaskQuery,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useGetCommentsQuery,
  useAddCommentMutation,
  useGetTaskHistoryQuery,
  useGetTimeEntriesQuery,
  useCreateTimeEntryMutation,
  useUpdateTimeEntryMutation,
  useDeleteTimeEntryMutation,
  useGetTaskFilesQuery,
  useUploadTaskFileMutation,
  useDeleteTaskFileMutation,
  useGetSubtasksQuery,
} from "@/api/tasksApi.js";
import {
  useSearchGhlUsersMutation,
  useSearchGhlContactsMutation,
  useCacheGhlUserMutation,
  useCacheGhlContactMutation,
} from "@/api/locationsApi.js";
import { useLocations } from "@/hooks/useLocations.js";
import { useCustomStatuses } from "@/hooks/useCustomStatuses.js";
import { useSession } from "@/hooks/useSession.js";
import { getIdentity } from "@/utils/session.js";
import { STATUSES, PRIORITIES, STATUS_LABEL, PRIORITY_LABEL, formatDuration } from "@/theme/status.js";
import { formatHistoryEntry, computeDueDateInputValue, dueDateIsoFromInput } from "@/utils/taskRecurrence.js";
import { NewTaskDialog } from "./NewTaskDialog.jsx";
import { LinkPreviews } from "./LinkPreviews.jsx";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/Sheet.jsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs.jsx";
import { Button } from "@/components/ui/Button.jsx";
import { Input } from "@/components/ui/Input.jsx";
import { Textarea } from "@/components/ui/Textarea.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select.jsx";
import { Checkbox } from "@/components/ui/Checkbox.jsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover.jsx";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/Command.jsx";
import { toast } from "sonner";
import {
  Paperclip,
  Play,
  Square,
  Trash2,
  Plus,
  Clock,
  MessageSquare,
  History,
  Files,
  ListTree,
  ArrowLeft,
  Calendar,
  User as UserIcon,
  ExternalLink,
} from "lucide-react";

function errMsg(err) {
  return err?.data?.error ?? err?.data?.detail ?? err?.message ?? "Request failed";
}

export function TaskDetail({
  taskId,
  onClose,
  onChange,
  onOpenTask,
  onBack,
  projects = [],
  meetingAccess = false,
}) {
  const session = useSession();
  const open = !!taskId;

  const taskQueryArg = useMemo(
    () => (meetingAccess ? { id: taskId, meeting_todos: true } : taskId),
    [taskId, meetingAccess],
  );
  const meetingOpts = meetingAccess ? { meeting_todos: true } : {};

  const { data: task, isLoading, isError } = useGetTaskQuery(taskQueryArg, { skip: !open });
  const { data: comments = [] } = useGetCommentsQuery(taskQueryArg, { skip: !open });
  const { data: history = [] } = useGetTaskHistoryQuery(taskQueryArg, { skip: !open });
  const { data: time = [] } = useGetTimeEntriesQuery(taskQueryArg, { skip: !open });
  const { data: files = [] } = useGetTaskFilesQuery(taskQueryArg, { skip: !open });
  const { data: subtasks = [] } = useGetSubtasksQuery(taskQueryArg, { skip: !open || !!task?.parent_task_id });

  const [updateTask] = useUpdateTaskMutation();
  const [deleteTask] = useDeleteTaskMutation();
  const [addCommentMut] = useAddCommentMutation();
  const [createTimeEntry] = useCreateTimeEntryMutation();
  const [updateTimeEntry] = useUpdateTimeEntryMutation();
  const [deleteTimeEntry] = useDeleteTimeEntryMutation();
  const [uploadTaskFile] = useUploadTaskFileMutation();
  const [deleteTaskFile] = useDeleteTaskFileMutation();
  const [searchGhlUsers] = useSearchGhlUsersMutation();
  const [searchGhlContacts] = useSearchGhlContactsMutation();
  const [cacheGhlUser] = useCacheGhlUserMutation();
  const [cacheGhlContact] = useCacheGhlContactMutation();

  const [newComment, setNewComment] = useState("");
  const [users, setUsers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [userQ, setUserQ] = useState("");
  const [contactQ, setContactQ] = useState("");
  const [openSubtaskDialog, setOpenSubtaskDialog] = useState(false);

  const { locations, locked, lockedLocationRowId } = useLocations();
  const [locationRowId, setLocationRowId] = useState(null);
  useEffect(() => {
    if (locked && lockedLocationRowId) {
      setLocationRowId(lockedLocationRowId);
      return;
    }
    if (task?.location_id && locations.length > 0) {
      const match = locations.find((l) => l.location_id === task.location_id);
      if (match) {
        setLocationRowId(match.id);
        return;
      }
    }
    if (!locationRowId && locations.length > 0) setLocationRowId(locations[0].id);
  }, [locations, locationRowId, locked, lockedLocationRowId, task?.location_id]);

  const currentLoc = locations.find((l) => l.id === locationRowId);
  const { statuses: customStatuses } = useCustomStatuses(currentLoc?.location_id ?? null);

  const statusLabels = useMemo(() => {
    const m = { ...STATUS_LABEL };
    for (const cs of customStatuses) m[`custom:${cs.key}`] = cs.label;
    return m;
  }, [customStatuses]);

  const projectById = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])),
    [projects],
  );

  const historyEntries = useMemo(() => {
    const formatted = history.map((h) => ({
      ...formatHistoryEntry(h, {
        statusLabel: statusLabels,
        priorityLabel: PRIORITY_LABEL,
        projectById,
      }),
      id: h.id,
    }));

    const loggedComments = new Set(
      history
        .filter((h) => h.action === "comment_added" || h.field === "comment")
        .map((h) => `${h.to_value}|${(h.created_at ?? "").slice(0, 16)}`),
    );

    const legacyComments = comments
      .filter((c) => !loggedComments.has(`${c.body}|${(c.created_at ?? "").slice(0, 16)}`))
      .map((c) => ({
        id: `comment-${c.id}`,
        who: c.author_name || "Someone",
        text: "added a comment",
        detail: c.body,
        when: c.created_at,
      }));

    return [...formatted, ...legacyComments].sort(
      (a, b) => new Date(b.when) - new Date(a.when),
    );
  }, [history, comments, statusLabels, projectById]);

  const fileInput = useRef(null);

  useEffect(() => {
    if (!open || !locationRowId) return;
    const t = setTimeout(() => {
      searchGhlUsers({ location_row_id: locationRowId, query: userQ })
        .unwrap()
        .then((r) => setUsers(r.users ?? []))
        .catch(() => setUsers([]));
    }, 200);
    return () => clearTimeout(t);
  }, [open, locationRowId, userQ, searchGhlUsers]);

  useEffect(() => {
    if (!open || !locationRowId) return;
    const t = setTimeout(() => {
      searchGhlContacts({ location_row_id: locationRowId, query: contactQ })
        .unwrap()
        .then((r) => setContacts(r.contacts ?? []))
        .catch(() => setContacts([]));
    }, 200);
    return () => clearTimeout(t);
  }, [open, locationRowId, contactQ, searchGhlContacts]);

  async function patch(fields) {
    if (!task) return;
    try {
      await updateTask({ id: task.id, ...meetingOpts, ...fields }).unwrap();
      onChange();
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  async function handleAddComment() {
    if (!newComment.trim() || !task) return;
    const me = getIdentity();
    try {
      await addCommentMut({
        taskId: task.id,
        ...meetingOpts,
        author_name: me?.name ?? "Anonymous",
        author_email: me?.email ?? null,
        body: newComment.trim(),
      }).unwrap();
      setNewComment("");
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  const activeEntry = useMemo(() => time.find((t) => !t.ended_at), [time]);

  async function startTimer() {
    if (!task) return;
    const me = getIdentity();
    try {
      await createTimeEntry({
        taskId: task.id,
        ...meetingOpts,
        user_name: me?.name ?? "Anonymous",
        started_at: new Date().toISOString(),
      }).unwrap();
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  async function stopTimer() {
    if (!activeEntry || !task) return;
    const ended = new Date();
    const dur = Math.round((ended.getTime() - new Date(activeEntry.started_at).getTime()) / 1000);
    try {
      await updateTimeEntry({
        taskId: task.id,
        entryId: activeEntry.id,
        ...meetingOpts,
        ended_at: ended.toISOString(),
        duration_seconds: dur,
      }).unwrap();
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  async function deleteTime(id) {
    if (!task) return;
    try {
      await deleteTimeEntry({ taskId: task.id, entryId: id, ...meetingOpts }).unwrap();
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  const totalSeconds = useMemo(
    () => time.filter((t) => t.duration_seconds).reduce((acc, t) => acc + (t.duration_seconds ?? 0), 0),
    [time],
  );

  async function uploadFile(file) {
    if (!task) return;
    const me = getIdentity();
    try {
      await uploadTaskFile({
        taskId: task.id,
        ...meetingOpts,
        file,
        uploaded_by: me?.name ?? null,
      }).unwrap();
      toast.success("File uploaded");
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  async function deleteFile(f) {
    if (!task) return;
    try {
      await deleteTaskFile({ taskId: task.id, fileId: f.id, ...meetingOpts }).unwrap();
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  if (!open) {
    return (
      <Sheet open={false} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="sm:max-w-2xl" />
      </Sheet>
    );
  }

  if (isLoading) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Loading…</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  if (isError || !task) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Could not load task</SheetTitle>
          </SheetHeader>
          <p className="text-sm text-muted-foreground mt-2">
            This task may not be visible to your account, or it may have been deleted.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={onClose}>
            Close
          </Button>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          {onBack && (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground self-start mb-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to parent task
            </button>
          )}
          <SheetTitle>
            <Input
              defaultValue={task.title}
              key={task.id}
              onBlur={(e) => e.target.value !== task.title && patch({ title: e.target.value })}
              className="text-lg font-semibold border-0 px-0 shadow-none focus-visible:ring-0"
            />
          </SheetTitle>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-3 mt-2 text-sm">
          <div>
            <div className="text-muted-foreground text-xs mb-1">Status</div>
            <Select
              value={task.custom_status_key ? `custom:${task.custom_status_key}` : task.status}
              onValueChange={(v) => {
                if (v.startsWith("custom:")) {
                  patch({ custom_status_key: v.slice("custom:".length) });
                } else {
                  patch({ status: v, custom_status_key: null });
                }
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                {customStatuses.map((cs) => (
                  <SelectItem key={cs.key} value={`custom:${cs.key}`}>{cs.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-muted-foreground text-xs mb-1">Priority</div>
            <Select value={task.priority} onValueChange={(v) => patch({ priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-muted-foreground text-xs mb-1">Due date</div>
            <Input
              type="date"
              key={`${task.id}-${task.due_date}-${task.recurrence}`}
              defaultValue={task.due_date ? task.due_date.slice(0, 10) : ""}
              readOnly={task.recurrence && task.recurrence !== "none"}
              onBlur={(e) => {
                if (task.recurrence && task.recurrence !== "none") return;
                patch({ due_date: e.target.value ? new Date(e.target.value).toISOString() : null });
              }}
            />
            {task.recurrence && task.recurrence !== "none" && (
              <p className="text-xs text-muted-foreground mt-1">Set automatically from the repeat schedule.</p>
            )}
          </div>
          {!task.parent_task_id && (
            <>
              <div>
                <div className="text-muted-foreground text-xs mb-1">Repeat</div>
                <Select
                  value={task.recurrence || "none"}
                  onValueChange={(v) => {
                    const interval = v === "custom" ? (task.recurrence_interval || 1) : 1;
                    const fields = {
                      recurrence: v,
                      recurrence_interval: interval,
                      recurrence_until: v === "none" ? null : task.recurrence_until,
                    };
                    if (v !== "none") {
                      fields.due_date = dueDateIsoFromInput(computeDueDateInputValue(v, interval));
                    }
                    patch(fields);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Does not repeat</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Every 2 weeks</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="custom">Custom (every N days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {task.recurrence === "custom" && (
                <div>
                  <div className="text-muted-foreground text-xs mb-1">Every N days</div>
                  <Input
                    type="number"
                    min={1}
                    key={`${task.id}-interval`}
                    defaultValue={task.recurrence_interval || 1}
                    onBlur={(e) => {
                      const n = Math.max(1, parseInt(e.target.value, 10) || 1);
                      if (n !== (task.recurrence_interval || 1)) {
                        patch({
                          recurrence_interval: n,
                          due_date: dueDateIsoFromInput(computeDueDateInputValue("custom", n)),
                        });
                      }
                    }}
                  />
                </div>
              )}
              {(task.recurrence && task.recurrence !== "none") && (
                <div>
                  <div className="text-muted-foreground text-xs mb-1">Repeat until</div>
                  <Input
                    type="date"
                    key={`${task.id}-until`}
                    defaultValue={task.recurrence_until ? task.recurrence_until.slice(0, 10) : ""}
                    onBlur={(e) => patch({
                      recurrence_until: e.target.value ? new Date(e.target.value + "T23:59:59").toISOString() : null,
                    })}
                  />
                </div>
              )}
            </>
          )}
          {!locked && (
            <div>
              <div className="text-muted-foreground text-xs mb-1">Location</div>
              <Select value={locationRowId ?? ""} onValueChange={(v) => setLocationRowId(v)} disabled={locations.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={locations.length === 0 ? "Add one in /admin" : "Select"} />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="col-span-2">
            <div className="text-muted-foreground text-xs mb-1">Assignees</div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start font-normal h-auto min-h-9 py-1.5" disabled={!locationRowId}>
                  {(task.ghl_assignee_names?.length ?? 0) === 0 ? (
                    <span className="text-muted-foreground">{locationRowId ? "Search & assign users…" : "Pick a location first"}</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {task.ghl_assignee_names.map((n) => (
                        <span key={n} className="rounded bg-accent px-1.5 py-0.5 text-xs">{n}</span>
                      ))}
                    </div>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Search users…" value={userQ} onValueChange={setUserQ} />
                  <CommandList>
                    <CommandEmpty>No users.</CommandEmpty>
                    <CommandGroup>
                      {users.map((u) => {
                        const ids = task.ghl_assignee_ids ?? [];
                        const names = task.ghl_assignee_names ?? [];
                        const checked = ids.includes(u.id);
                        return (
                          <CommandItem
                            key={u.id}
                            onSelect={async () => {
                              const nextIds = checked ? ids.filter((x) => x !== u.id) : [...ids, u.id];
                              const nextNames = checked
                                ? names.filter((_, i) => ids[i] !== u.id)
                                : [...names, u.name];
                              if (!checked && currentLoc) {
                                try {
                                  await cacheGhlUser({
                                    ghl_id: u.id,
                                    location_id: currentLoc.location_id,
                                    name: u.name,
                                    email: u.email ?? null,
                                    phone: u.phone ?? null,
                                  }).unwrap();
                                } catch {}
                              }
                              patch({
                                ghl_assignee_ids: nextIds,
                                ghl_assignee_names: nextNames,
                                ghl_assignee_id: nextIds[0] ?? null,
                                ghl_assignee_name: nextNames[0] ?? null,
                              });
                            }}
                          >
                            <Checkbox checked={checked} className="mr-2" />
                            <div className="flex flex-col">
                              <span>{u.name}</span>
                              {u.email && <span className="text-xs text-muted-foreground">{u.email}</span>}
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="col-span-2">
            <div className="text-muted-foreground text-xs mb-1">Contact</div>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 justify-start font-normal" disabled={!locationRowId}>
                    {task.ghl_contact_name ?? (locationRowId ? "Search contacts…" : "Pick a location first")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
                  <Command shouldFilter={false}>
                    <CommandInput placeholder="Search contacts…" value={contactQ} onValueChange={setContactQ} />
                    <CommandList>
                      <CommandEmpty>No contacts.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem onSelect={() => patch({ ghl_contact_id: null, ghl_contact_name: null })}>
                          — None —
                        </CommandItem>
                        {contacts.map((c) => (
                          <CommandItem
                            key={c.id}
                            onSelect={async () => {
                              if (currentLoc) {
                                try {
                                  await cacheGhlContact({
                                    ghl_id: c.id,
                                    location_id: currentLoc.location_id,
                                    name: c.name,
                                    email: c.email ?? null,
                                    phone: c.phone ?? null,
                                  }).unwrap();
                                } catch {}
                              }
                              patch({ ghl_contact_id: c.id, ghl_contact_name: c.name });
                            }}
                          >
                            <div className="flex flex-col">
                              <span>{c.name}</span>
                              {(c.email || c.phone) && (
                                <span className="text-xs text-muted-foreground">
                                  {[c.email, c.phone].filter(Boolean).join(" · ")}
                                </span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {task.ghl_contact_id && (
                <Button
                  variant="outline"
                  size="icon"
                  title="Open contact"
                  onClick={() => {
                    const ref = typeof document !== "undefined" ? document.referrer : "";
                    const locId = session.ghlLocationId;
                    let base = "https://app.gohighlevel.com";
                    try {
                      if (ref) {
                        const u = new URL(ref);
                        base = `${u.protocol}//${u.host}`;
                      }
                    } catch {}
                    if (!locId) {
                      toast.error("No location id");
                      return;
                    }
                    const url = `${base}/v2/location/${locId}/contacts/detail/${task.ghl_contact_id}`;
                    window.open(url, "_blank", "noopener,noreferrer");
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          {!task.parent_task_id && (
            <div className="col-span-2">
              <div className="text-muted-foreground text-xs mb-1">Project</div>
              <Select
                value={task.project_id ?? "none"}
                onValueChange={(v) => patch({ project_id: v === "none" ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="col-span-2">
            <div className="text-muted-foreground text-xs mb-1">Description</div>
            <Textarea
              key={task.id}
              defaultValue={task.description ?? ""}
              rows={4}
              onBlur={(e) => e.target.value !== (task.description ?? "") && patch({ description: e.target.value || null })}
              placeholder="Add details, links, acceptance criteria…"
            />
            <LinkPreviews text={task.description ?? ""} />
          </div>
        </div>

        {!task.parent_task_id && (
          <div className="mt-4">
            <div className="text-muted-foreground text-xs mb-1">Labels</div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(task.labels ?? []).map((l) => (
                <span key={l} className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs">
                  {l}
                  <button
                    onClick={() => patch({ labels: (task.labels ?? []).filter((x) => x !== l) })}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${l}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <Input
                placeholder="Add label and press Enter"
                className="h-7 w-48 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = (e.currentTarget.value || "").trim();
                    if (!v) return;
                    const existing = task.labels ?? [];
                    if (existing.includes(v)) {
                      e.currentTarget.value = "";
                      return;
                    }
                    patch({ labels: [...existing, v] });
                    e.currentTarget.value = "";
                  }
                }}
              />
            </div>
          </div>
        )}

        <Tabs defaultValue="comments" className="mt-6">
          <TabsList>
            <TabsTrigger value="comments"><MessageSquare className="h-3.5 w-3.5 mr-1.5" />Comments</TabsTrigger>
            {!task.parent_task_id && (
              <TabsTrigger value="subtasks"><ListTree className="h-3.5 w-3.5 mr-1.5" />Subtasks</TabsTrigger>
            )}
            <TabsTrigger value="time"><Clock className="h-3.5 w-3.5 mr-1.5" />Time</TabsTrigger>
            <TabsTrigger value="files"><Files className="h-3.5 w-3.5 mr-1.5" />Files</TabsTrigger>
            <TabsTrigger value="history"><History className="h-3.5 w-3.5 mr-1.5" />History</TabsTrigger>
          </TabsList>

          <TabsContent value="comments" className="space-y-4">
            <div className="space-y-3">
              {comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
              {comments.map((c) => (
                <div key={c.id} className="rounded-md border bg-card p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm font-medium">{c.author_name}</div>
                    <div className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</div>
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{c.body}</div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Write a comment…" rows={3} />
              <div className="flex justify-end">
                <Button size="sm" onClick={handleAddComment} disabled={!newComment.trim()}>Comment</Button>
              </div>
            </div>
          </TabsContent>

          {!task.parent_task_id && (
            <TabsContent value="subtasks" className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">{subtasks.length} subtask{subtasks.length === 1 ? "" : "s"}</div>
                <Button size="sm" variant="outline" onClick={() => setOpenSubtaskDialog(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add subtask
                </Button>
              </div>
              <div className="space-y-1">
                {subtasks
                  .filter((s) => {
                    if (session.isAdmin) return true;
                    if (!session.ghlUserId) return false;
                    const uid = session.ghlUserId;
                    const parentAssigned = (task.ghl_assignee_ids ?? []).includes(uid);
                    return parentAssigned || (s.ghl_assignee_ids ?? []).includes(uid);
                  })
                  .map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-sm hover:bg-accent cursor-pointer"
                      onClick={() => onOpenTask?.(s.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`status-pill status-${s.status}`}>{STATUS_LABEL[s.status]}</span>
                          <span className="truncate">{s.title}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {(s.ghl_assignee_names?.length ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1"><UserIcon className="h-3 w-3" />{s.ghl_assignee_names.join(", ")}</span>
                          )}
                          {s.due_date && (
                            <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(s.due_date).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={s.status}
                          onValueChange={async (v) => {
                            try {
                              await updateTask({ id: s.id, ...meetingOpts, status: v }).unwrap();
                              onChange();
                            } catch (err) {
                              toast.error(errMsg(err));
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((st) => <SelectItem key={st} value={st}>{STATUS_LABEL[st]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
              </div>
              <NewTaskDialog
                open={openSubtaskDialog}
                onOpenChange={setOpenSubtaskDialog}
                onCreated={() => onChange()}
                parentTaskId={task.id}
              />
            </TabsContent>
          )}

          <TabsContent value="time" className="space-y-3">
            <div className="flex items-center justify-between rounded-md border bg-card p-3">
              <div>
                <div className="text-xs text-muted-foreground">Total tracked</div>
                <div className="text-lg font-semibold tabular-nums">{formatDuration(totalSeconds)}</div>
              </div>
              {activeEntry ? (
                <Button onClick={stopTimer} variant="destructive" size="sm">
                  <Square className="h-3.5 w-3.5 mr-1" />Stop
                </Button>
              ) : (
                <Button onClick={startTimer} size="sm">
                  <Play className="h-3.5 w-3.5 mr-1" />Start timer
                </Button>
              )}
            </div>
            <div className="space-y-1">
              {time.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm border-b py-2">
                  <div>
                    <div className="font-medium">{t.user_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(t.started_at).toLocaleString()} {t.ended_at ? `→ ${new Date(t.ended_at).toLocaleString()}` : "· running"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums">{t.duration_seconds ? formatDuration(t.duration_seconds) : "—"}</span>
                    <Button variant="ghost" size="icon" onClick={() => deleteTime(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
              {time.length === 0 && <p className="text-sm text-muted-foreground">No time entries yet.</p>}
            </div>
          </TabsContent>

          <TabsContent value="files" className="space-y-3">
            <div>
              <input
                ref={fileInput}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadFile(f);
                  e.currentTarget.value = "";
                }}
              />
              <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
                <Paperclip className="h-3.5 w-3.5 mr-1" />Upload file
              </Button>
            </div>
            <div className="space-y-1">
              {files.map((f) => (
                <div key={f.id} className="flex items-center justify-between text-sm border-b py-2">
                  <a href={f.url} target="_blank" rel="noreferrer" className="hover:underline truncate">{f.file_name}</a>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{f.uploaded_by ?? "—"}</span>
                    <Button variant="ghost" size="icon" onClick={() => deleteFile(f)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
              {files.length === 0 && <p className="text-sm text-muted-foreground">No files yet.</p>}
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-0">
            {historyEntries.length === 0 && <p className="text-sm text-muted-foreground py-2">No activity yet.</p>}
            {historyEntries.map((h) => (
              <div key={h.id} className="border-b py-3 flex justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed">
                    <span className="font-medium">{h.who}</span>{" "}
                    <span className="text-foreground/90">{h.text}</span>
                  </p>
                  {h.detail && (
                    <p className="mt-1.5 text-xs text-muted-foreground whitespace-pre-wrap break-words rounded-md bg-muted/40 px-2.5 py-2 border">
                      {h.detail}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0 pt-0.5">
                  {new Date(h.when).toLocaleString()}
                </span>
              </div>
            ))}
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              if (!confirm("Delete this task?")) return;
              try {
                await deleteTask(meetingAccess ? { id: task.id, meeting_todos: true } : task.id).unwrap();
                onChange();
                onClose();
              } catch (err) {
                toast.error(errMsg(err));
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />Delete task
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
