import { useEffect, useState } from "react";
import { useLocations } from "@/hooks/useLocations.js";
import { computeDueDateInputValue } from "@/utils/taskRecurrence.js";
import { useCustomStatuses } from "@/hooks/useCustomStatuses.js";
import {
  useSearchGhlUsersMutation,
  useSearchGhlContactsMutation,
  useCacheGhlUserMutation,
  useCacheGhlContactMutation,
} from "@/api/locationsApi.js";
import { useCreateTaskMutation } from "@/api/tasksApi.js";
import { getIdentity } from "@/utils/session.js";
import { STATUSES, PRIORITIES, STATUS_LABEL, PRIORITY_LABEL } from "@/theme/status.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/Dialog.jsx";
import { Input } from "@/components/ui/Input.jsx";
import { Textarea } from "@/components/ui/Textarea.jsx";
import { Label } from "@/components/ui/Label.jsx";
import { Button } from "@/components/ui/Button.jsx";
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
import { toast } from "sonner";

function apiErrorMessage(err, fallback) {
  const data = err?.data;
  if (typeof data === "string") return data;
  if (data?.detail) return String(data.detail);
  if (data?.message) return String(data.message);
  if (Array.isArray(data?.errors) && data.errors[0]?.detail) return String(data.errors[0].detail);
  return err?.message || fallback;
}

export function NewTaskDialog({
  open,
  onOpenChange,
  onCreated,
  parentTaskId,
  projects = [],
  defaultProjectId = null,
  initialValues = null,
  dialogTitle,
  dialogDescription,
  submitLabel = "Create",
  defaultLocationGhlId = null,
}) {
  const [projectId, setProjectId] = useState(defaultProjectId);
  const { locations, locked, lockedLocationRowId } = useLocations();
  const [locationRowId, setLocationRowId] = useState(null);

  const [searchUsers] = useSearchGhlUsersMutation();
  const [searchContacts] = useSearchGhlContactsMutation();
  const [cacheGhlUser] = useCacheGhlUserMutation();
  const [cacheGhlContact] = useCacheGhlContactMutation();
  const [createTask] = useCreateTaskMutation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [assignee, setAssignee] = useState(null);
  const [contact, setContact] = useState(null);
  const [recurrence, setRecurrence] = useState("none");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceUntil, setRecurrenceUntil] = useState("");

  const [users, setUsers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [userQ, setUserQ] = useState("");
  const [contactQ, setContactQ] = useState("");

  useEffect(() => {
    if (locked && lockedLocationRowId) {
      setLocationRowId(lockedLocationRowId);
      return;
    }
    if (!locationRowId && locations.length > 0) setLocationRowId(locations[0].id);
  }, [locations, locationRowId, locked, lockedLocationRowId]);

  useEffect(() => {
    if (open) setProjectId(defaultProjectId);
  }, [open, defaultProjectId]);

  useEffect(() => {
    if (!open) return;
    if (initialValues) {
      setTitle(initialValues.title ?? "");
      setDescription(initialValues.description ?? "");
      setStatus(initialValues.status ?? "todo");
      setPriority(initialValues.priority ?? "medium");
      setDueDate(initialValues.dueDate ?? "");
      setAssignee(initialValues.assignee ?? null);
      setContact(initialValues.contact ?? null);
      setRecurrence(initialValues.recurrence ?? "none");
      setRecurrenceInterval(initialValues.recurrenceInterval ?? 1);
      setRecurrenceUntil(initialValues.recurrenceUntil ?? "");
    }
    if (defaultLocationGhlId && locations.length > 0) {
      const match = locations.find((l) => l.location_id === defaultLocationGhlId);
      if (match) setLocationRowId(match.id);
    }
  }, [open, initialValues, defaultLocationGhlId, locations]);

  useEffect(() => {
    if (!open || !locationRowId) return;
    const t = setTimeout(() => {
      searchUsers({ location_row_id: locationRowId, query: userQ })
        .unwrap()
        .then((r) => setUsers(r.users ?? []))
        .catch(() => setUsers([]));
    }, 200);
    return () => clearTimeout(t);
  }, [open, locationRowId, userQ, searchUsers]);

  useEffect(() => {
    if (!open || !locationRowId) return;
    const t = setTimeout(() => {
      searchContacts({ location_row_id: locationRowId, query: contactQ })
        .unwrap()
        .then((r) => setContacts(r.contacts ?? []))
        .catch(() => setContacts([]));
    }, 200);
    return () => clearTimeout(t);
  }, [open, locationRowId, contactQ, searchContacts]);

  useEffect(() => {
    if (!open || parentTaskId || recurrence === "none") return;
    setDueDate(computeDueDateInputValue(recurrence, recurrenceInterval));
  }, [open, parentTaskId, recurrence, recurrenceInterval]);

  function reset() {
    setTitle("");
    setDescription("");
    setStatus("todo");
    setPriority("medium");
    setDueDate("");
    setAssignee(null);
    setContact(null);
    setRecurrence("none");
    setRecurrenceInterval(1);
    setRecurrenceUntil("");
    setUserQ("");
    setContactQ("");
    setProjectId(defaultProjectId);
  }

  const currentLoc = locations.find((l) => l.id === locationRowId);
  const { statuses: customStatuses } = useCustomStatuses(currentLoc?.location_id ?? null);

  async function submit() {
    if (!title.trim()) return;
    if (locked && !currentLoc?.location_id) {
      toast.error("Location is required to create a task");
      return;
    }
    const me = getIdentity();

    if (contact && currentLoc) {
      try {
        await cacheGhlContact({
          ghl_id: contact.id,
          location_id: currentLoc.location_id,
          name: contact.name,
          email: contact.email ?? null,
          phone: contact.phone ?? null,
        }).unwrap();
      } catch {
        /* cache is best-effort */
      }
    }
    if (assignee && currentLoc) {
      try {
        await cacheGhlUser({
          ghl_id: assignee.id,
          location_id: currentLoc.location_id,
          name: assignee.name,
          email: assignee.email ?? null,
          phone: assignee.phone ?? null,
        }).unwrap();
      } catch {
        /* cache is best-effort */
      }
    }

    const isCustom = status.startsWith("custom:");
    const customKey = isCustom ? status.slice("custom:".length) : null;

    try {
      await createTask({
        title: title.trim(),
        description: description.trim() || null,
        status: isCustom ? "todo" : status,
        custom_status_key: customKey,
        priority,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        ghl_assignee_id: assignee?.id ?? null,
        ghl_assignee_name: assignee?.name ?? null,
        ghl_assignee_ids: assignee ? [assignee.id] : [],
        ghl_assignee_names: assignee ? [assignee.name] : [],
        ghl_contact_id: contact?.id ?? null,
        ghl_contact_name: contact?.name ?? null,
        parent_task_id: parentTaskId ?? null,
        project_id: parentTaskId ? null : projectId,
        location_id: currentLoc?.location_id ?? null,
        created_by: me?.name ?? null,
        recurrence: parentTaskId ? "none" : recurrence,
        recurrence_interval: recurrence === "custom" ? Math.max(1, recurrenceInterval) : 1,
        recurrence_until: !parentTaskId && recurrence !== "none" && recurrenceUntil
          ? new Date(recurrenceUntil + "T23:59:59").toISOString()
          : null,
      }).unwrap();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to create task"));
      return;
    }

    toast.success(
      parentTaskId ? "Subtask created" : initialValues ? "Task created from issue" : "Task created",
    );
    reset();
    onOpenChange(false);
    onCreated?.();
  }

  const heading = dialogTitle ?? (parentTaskId ? "New subtask" : "New task");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          {dialogDescription && (
            <DialogDescription>{dialogDescription}</DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ship the new pricing page"
              autoFocus
            />
          </div>
          {!parentTaskId && projects.length > 0 && (
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select
                value={projectId ?? "none"}
                onValueChange={(v) => setProjectId(v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Add details, links, acceptance criteria…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                  {customStatuses.map((cs) => (
                    <SelectItem key={cs.key} value={`custom:${cs.key}`}>
                      {cs.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className={`grid gap-3 ${locked ? "grid-cols-1" : "grid-cols-2"}`}>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input
                type="date"
                value={dueDate}
                readOnly={recurrence !== "none"}
                onChange={(e) => setDueDate(e.target.value)}
              />
              {recurrence !== "none" && (
                <p className="text-xs text-muted-foreground">Set automatically from the repeat schedule.</p>
              )}
            </div>
            {!locked && (
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Select
                  value={locationRowId ?? ""}
                  onValueChange={setLocationRowId}
                  disabled={locations.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={locations.length === 0 ? "Add one in /admin" : "Select"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {!parentTaskId && (
            <div className="space-y-3 rounded-md border p-3 bg-muted/20">
              <Label>Repeat</Label>
              <div className="grid grid-cols-2 gap-3">
                <Select value={recurrence} onValueChange={setRecurrence}>
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
                {recurrence === "custom" && (
                  <Input
                    type="number"
                    min={1}
                    value={recurrenceInterval}
                    onChange={(e) => setRecurrenceInterval(parseInt(e.target.value, 10) || 1)}
                    placeholder="Every N days"
                  />
                )}
              </div>
              {recurrence !== "none" && (
                <div className="space-y-1.5">
                  <Label>Repeat until (optional)</Label>
                  <Input type="date" value={recurrenceUntil} onChange={(e) => setRecurrenceUntil(e.target.value)} />
                </div>
              )}
              {recurrence !== "none" && (
                <p className="text-xs text-muted-foreground">
                  The next occurrence is created automatically when each due date arrives, even if the previous task is not completed.
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Assignee</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start font-normal"
                  disabled={!locationRowId}
                >
                  {assignee?.name ?? (locationRowId ? "Search users…" : "Pick a location first")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Search users…" value={userQ} onValueChange={setUserQ} />
                  <CommandList>
                    <CommandEmpty>No users.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem onSelect={() => setAssignee(null)}>— Unassigned —</CommandItem>
                      {users.map((u) => (
                        <CommandItem key={u.id} onSelect={() => setAssignee(u)}>
                          <div className="flex flex-col">
                            <span>{u.name}</span>
                            {u.email && <span className="text-xs text-muted-foreground">{u.email}</span>}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label>Contact</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start font-normal"
                  disabled={!locationRowId}
                >
                  {contact?.name ?? (locationRowId ? "Search contacts…" : "Pick a location first")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search contacts…"
                    value={contactQ}
                    onValueChange={setContactQ}
                  />
                  <CommandList>
                    <CommandEmpty>No contacts.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem onSelect={() => setContact(null)}>— None —</CommandItem>
                      {contacts.map((c) => (
                        <CommandItem key={c.id} onSelect={() => setContact(c)}>
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
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim()}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
