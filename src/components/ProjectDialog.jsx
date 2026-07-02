import { useEffect, useState } from "react";
import { useSession } from "@/hooks/useSession.js";
import { useLocations } from "@/hooks/useLocations.js";
import { useGetGhlUsersQuery } from "@/api/locationsApi.js";
import { useCreateProjectMutation, useUpdateProjectMutation } from "@/api/projectsApi.js";
import { getIdentity } from "@/utils/session.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/Dialog.jsx";
import { Input } from "@/components/ui/Input.jsx";
import { Textarea } from "@/components/ui/Textarea.jsx";
import { Label } from "@/components/ui/Label.jsx";
import { Button } from "@/components/ui/Button.jsx";
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
import { toast } from "sonner";

const COLOR_SWATCHES = [
  "#ff8500",
  "#ef4444",
  "#f59e0b",
  "#eab308",
  "#22c55e",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
];

function apiErrorMessage(err, fallback) {
  const data = err?.data;
  if (typeof data === "string") return data;
  if (data?.detail) return String(data.detail);
  if (data?.message) return String(data.message);
  if (Array.isArray(data?.errors) && data.errors[0]?.detail) return String(data.errors[0].detail);
  return err?.message || fallback;
}

export function ProjectDialog({ open, onOpenChange, onSaved, project }) {
  const session = useSession();
  const { locations } = useLocations();
  const effectiveLocationId =
    session.ghlLocationId ?? locations[0]?.location_id ?? null;
  const skipUsers = !open || !effectiveLocationId;
  const { data: usersData } = useGetGhlUsersQuery(
    { location_id: effectiveLocationId },
    { skip: skipUsers },
  );
  const users = usersData?.users ?? [];

  const [createProject] = useCreateProjectMutation();
  const [updateProject] = useUpdateProjectMutation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeIds, setAssigneeIds] = useState([]);
  const [color, setColor] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (project) {
      setTitle(project.title || "");
      setDescription(project.description || "");
      setDueDate(project.due_date ? project.due_date.slice(0, 10) : "");
      setAssigneeIds(project.ghl_assignee_ids ?? []);
      setColor(project.color ?? null);
    } else {
      setTitle("");
      setDescription("");
      setDueDate("");
      setAssigneeIds([]);
      setColor(null);
    }
  }, [open, project]);

  async function submit() {
    if (!title.trim()) return;
    const me = getIdentity();
    const names = assigneeIds.map((id) => users.find((u) => u.id === id)?.name ?? id);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      ghl_assignee_ids: assigneeIds,
      ghl_assignee_names: names,
      color,
    };

    try {
      if (project?.id) {
        await updateProject({ id: project.id, ...payload }).unwrap();
        toast.success("Project updated");
      } else {
        await createProject({
          ...payload,
          created_by: me?.name ?? null,
          location_id: effectiveLocationId,
        }).unwrap();
        toast.success("Project created");
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, project?.id ? "Failed to update project" : "Failed to create project"));
      return;
    }

    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Marketing site v2"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                onClick={() => setColor(null)}
                className={`h-7 w-7 rounded-full border-2 flex items-center justify-center text-xs ${
                  color === null ? "border-foreground" : "border-border"
                }`}
                title="No color"
              >
                ✕
              </button>
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full border-2 ${
                    color === c ? "border-foreground" : "border-transparent"
                  }`}
                  style={{ background: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Assignees</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal h-auto min-h-9 py-1.5">
                    {assigneeIds.length === 0 ? (
                      <span className="text-muted-foreground">Unassigned</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {assigneeIds.map((id) => (
                          <span key={id} className="rounded bg-accent px-1.5 py-0.5 text-xs">
                            {users.find((u) => u.id === id)?.name ?? id}
                          </span>
                        ))}
                      </div>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
                  <Command>
                    <CommandInput placeholder="Search users…" />
                    <CommandList>
                      <CommandEmpty>No users.</CommandEmpty>
                      <CommandGroup>
                        {users.map((u) => {
                          const checked = assigneeIds.includes(u.id);
                          return (
                            <CommandItem
                              key={u.id}
                              onSelect={() => {
                                setAssigneeIds(
                                  checked ? assigneeIds.filter((x) => x !== u.id) : [...assigneeIds, u.id],
                                );
                              }}
                            >
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
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim()}>
            {project ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
