import { useMemo, useState } from "react";
import { Plus, Trash2, RotateCcw, Check } from "lucide-react";
import { toast } from "sonner";
import {
  useGetOfficeTodosQuery,
  useCreateOfficeTodoMutation,
  useUpdateOfficeTodoMutation,
  useDeleteOfficeTodoMutation,
} from "@/api/officeTodosApi.js";
import { useSession } from "@/hooks/useSession.js";
import { Button } from "@/components/ui/Button.jsx";
import { Input } from "@/components/ui/Input.jsx";
import { Checkbox } from "@/components/ui/Checkbox.jsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select.jsx";

const WHO_NONE = "__none__";
const WHO_ALL = "All";

function apiError(err, fallback) {
  const data = err?.data;
  if (data?.data?.error) return String(data.data.error);
  if (data?.error) return String(data.error);
  if (data?.detail) return String(data.detail);
  if (Array.isArray(data?.errors) && data.errors[0]?.detail) return String(data.errors[0].detail);
  return err?.message || fallback;
}

function formatDue(value) {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

export function OfficeTodosPanel({ locationId, eventId, users = [], compact = false }) {
  const session = useSession();
  const locId = locationId || session.ghlLocationId;
  const skip = !session.loaded || !locId || !eventId;
  const queryParams = {
    ...(locId ? { location_id: locId } : {}),
    ...(eventId ? { event_id: eventId } : {}),
  };

  const { data: todos = [], isLoading } = useGetOfficeTodosQuery(queryParams, { skip });
  const [createTodo] = useCreateOfficeTodoMutation();
  const [updateTodo] = useUpdateOfficeTodoMutation();
  const [deleteTodo] = useDeleteOfficeTodoMutation();

  const [draftTitle, setDraftTitle] = useState("");
  const [draftWho, setDraftWho] = useState(WHO_NONE);
  const [draftDue, setDraftDue] = useState("");
  const [busyId, setBusyId] = useState(null);

  const whoOptions = useMemo(() => {
    const names = users
      .map((u) => u.name || u.email || u.ghl_id)
      .filter(Boolean);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [users]);

  const { openItems, doneItems } = useMemo(() => {
    const open = [];
    const done = [];
    for (const t of todos) {
      if (t.is_done) done.push(t);
      else open.push(t);
    }
    return { openItems: open, doneItems: done };
  }, [todos]);

  async function handleAdd(e) {
    e?.preventDefault?.();
    const title = draftTitle.trim();
    if (!title || !locId || !eventId) return;
    if (draftWho === WHO_NONE) {
      toast.error("Who is required");
      return;
    }
    if (!draftDue) {
      toast.error("Date is required");
      return;
    }
    try {
      await createTodo({
        title,
        who: draftWho,
        due_date: draftDue,
        location_id: locId,
        event_id: eventId,
        created_by: session.name || undefined,
      }).unwrap();
      setDraftTitle("");
      setDraftWho(WHO_NONE);
      setDraftDue("");
      toast.success("Added to To Do");
    } catch (err) {
      toast.error(apiError(err, "Could not add item"));
    }
  }

  async function setDone(todo, isDone) {
    setBusyId(todo.id);
    try {
      await updateTodo({ id: todo.id, is_done: isDone }).unwrap();
      toast.success(isDone ? "Moved to To Done" : "Moved back to To Do");
    } catch (err) {
      toast.error(apiError(err, "Could not update item"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(todo) {
    setBusyId(todo.id);
    try {
      await deleteTodo(todo.id).unwrap();
      toast.success("Deleted");
    } catch (err) {
      toast.error(apiError(err, "Could not delete item"));
    } finally {
      setBusyId(null);
    }
  }

  const loading = !session.loaded || isLoading;

  return (
    <div className={compact ? "" : "max-w-4xl"}>
      {!compact && (
        <div className="mb-5">
          <h2 className="text-2xl font-bold tracking-tight">To-Do Review</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Meeting to-dos for this event (shared across all occurrences if recurring) · 5 minutes
          </p>
        </div>
      )}

      <form
        onSubmit={handleAdd}
        className="mb-8 grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_140px_auto] gap-2"
      >
        <Input
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder="What do we need to do?"
          disabled={loading || !locId || !eventId}
        />
        <Select value={draftWho} onValueChange={setDraftWho} disabled={loading || !locId || !eventId}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Who" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={WHO_NONE}>Who</SelectItem>
            <SelectItem value={WHO_ALL}>All</SelectItem>
            {whoOptions.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={draftDue}
          onChange={(e) => setDraftDue(e.target.value)}
          disabled={loading || !locId || !eventId}
        />
        <Button
          type="submit"
          disabled={
            !draftTitle.trim() ||
            draftWho === WHO_NONE ||
            !draftDue ||
            loading ||
            !locId ||
            !eventId
          }
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add
        </Button>
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-8">
          <TodoSection
            heading="What (To Do)"
            count={openItems.length}
            empty="Nothing on the to-do list yet."
            items={openItems}
            busyId={busyId}
            onToggle={(todo) => setDone(todo, true)}
            onDelete={handleDelete}
          />
          <TodoSection
            heading="What (To Done)"
            count={doneItems.length}
            empty="No completed to-dos yet."
            items={doneItems}
            busyId={busyId}
            onToggle={(todo) => setDone(todo, false)}
            onDelete={handleDelete}
            restore
          />
        </div>
      )}
    </div>
  );
}

function TodoSection({ heading, count, empty, items, busyId, onToggle, onDelete, restore = false }) {
  return (
    <section>
      <h3 className="text-sm font-semibold mb-3">
        {heading} <span className="text-muted-foreground font-normal">({count})</span>
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">{empty}</p>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-card">
          <div className="hidden sm:grid grid-cols-[auto_minmax(0,2fr)_minmax(0,1fr)_120px_auto] gap-3 px-3 py-2 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
            <span className="w-4" />
            <span>What</span>
            <span>Who</span>
            <span>by When</span>
            <span className="w-16" />
          </div>
          <ul className="divide-y">
            {items.map((todo) => (
              <TodoRow
                key={todo.id}
                todo={todo}
                busy={busyId === todo.id}
                onToggle={() => onToggle(todo)}
                onDelete={() => onDelete(todo)}
                restore={restore}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function TodoRow({ todo, busy, onToggle, onDelete, restore = false }) {
  return (
    <li className="group grid grid-cols-1 sm:grid-cols-[auto_minmax(0,2fr)_minmax(0,1fr)_120px_auto] gap-2 sm:gap-3 items-center px-3 py-2.5">
      <div className="flex items-center gap-3 sm:contents">
        {restore ? (
          <button
            type="button"
            onClick={onToggle}
            disabled={busy}
            title="Move back to To Do"
            className="shrink-0 h-4 w-4 rounded-sm border border-primary bg-primary text-primary-foreground flex items-center justify-center"
          >
            <Check className="h-3 w-3" />
          </button>
        ) : (
          <Checkbox
            checked={false}
            disabled={busy}
            onCheckedChange={() => onToggle()}
            aria-label={`Mark "${todo.title}" done`}
          />
        )}
        <span
          className={`text-sm min-w-0 break-words ${
            todo.is_done ? "text-muted-foreground line-through" : "text-foreground"
          }`}
        >
          {todo.title}
        </span>
      </div>
      <span className="text-sm text-muted-foreground pl-7 sm:pl-0">{todo.who || "—"}</span>
      <span className="text-sm text-muted-foreground pl-7 sm:pl-0">{formatDue(todo.due_date)}</span>
      <div className="flex items-center gap-1 justify-end opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 pl-7 sm:pl-0">
        {restore && (
          <button
            type="button"
            onClick={onToggle}
            disabled={busy}
            title="Move to To Do"
            className="p-1.5 text-muted-foreground hover:text-foreground rounded"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          title="Delete"
          className="p-1.5 text-muted-foreground hover:text-destructive rounded"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}
