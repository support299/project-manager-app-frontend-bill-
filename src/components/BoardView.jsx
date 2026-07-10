import { useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  MeasuringStrategy,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Calendar,
  Folder,
  GripVertical,
  ListTree,
  Repeat,
  User as UserIcon,
} from "lucide-react";
import { STATUS_LABEL, PRIORITY_LABEL } from "@/theme/status.js";
import { toast } from "sonner";

const COLUMN_WIDTH = 300;
const HIDDEN_WHEN_EMPTY = new Set(["archive", "cancelled"]);

function statusKeyForTask(task) {
  return task.custom_status_key ? `custom:${task.custom_status_key}` : task.status;
}

function statusPayload(statusKey) {
  if (statusKey.startsWith("custom:")) {
    return { custom_status_key: statusKey.slice("custom:".length) };
  }
  return { status: statusKey, custom_status_key: null };
}

function columnLabel(statusKey, customByKey) {
  const cs = customByKey[statusKey];
  if (cs) return cs.label;
  return STATUS_LABEL[statusKey] ?? statusKey;
}

function columnAccent(statusKey, customByKey) {
  const cs = customByKey[statusKey];
  if (cs?.color) return cs.color;
  const map = {
    backlog: "var(--status-backlog)",
    todo: "var(--status-todo)",
    in_progress: "var(--status-in_progress)",
    review: "var(--status-review)",
    done: "var(--status-done)",
    archive: "var(--status-archive)",
    cancelled: "var(--status-cancelled)",
  };
  return map[statusKey] ?? "var(--muted)";
}

function visibleStatusKeys(allStatusKeys, grouped) {
  return allStatusKeys.filter((key) => {
    const count = (grouped[key] ?? []).length;
    if (count > 0) return true;
    if (HIDDEN_WHEN_EMPTY.has(key)) return false;
    return true;
  });
}

function resolveDropTarget(over, taskById) {
  if (!over) return null;

  const overData = over.data?.current;
  if (overData?.type === "column") return overData.statusKey;
  if (overData?.type === "task") return statusKeyForTask(overData.task);

  const overId = String(over.id);
  if (overId.startsWith("column-")) return overId.slice("column-".length);

  const overTask = taskById.get(over.id);
  if (overTask) return statusKeyForTask(overTask);

  return null;
}

function collisionDetection(args) {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  return rectIntersection(args);
}

function BoardCardContent({ task, projectById }) {
  const project = task.project_id ? projectById[task.project_id] : null;

  return (
    <div className="min-w-0 flex-1 p-3 pl-0 text-left pointer-events-none select-none">
      <div className="font-medium text-sm leading-snug line-clamp-2 flex items-start gap-1.5">
        <span className="flex-1">{task.title}</span>
        {task.recurrence && task.recurrence !== "none" && (
          <Repeat className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
        )}
        {(task.subtask_count ?? 0) > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground shrink-0">
            <ListTree className="h-3 w-3" />
            {task.subtask_count}
          </span>
        )}
      </div>
      {task.description && (
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{task.description}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {project && (
          <span
            className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted/80 px-2 py-0.5 text-xs font-medium text-muted-foreground"
            title={project.title}
          >
            <Folder className="h-3 w-3 shrink-0" />
            <span className="truncate">{project.title}</span>
          </span>
        )}
        <span className="rounded-md bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
          {PRIORITY_LABEL[task.priority]}
        </span>
        {task.labels?.slice(0, 2).map((l) => (
          <span key={l} className="rounded-md bg-accent px-2 py-0.5 text-xs">
            {l}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {(task.ghl_assignee_names?.length ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1 max-w-full">
            <UserIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{task.ghl_assignee_names.join(", ")}</span>
          </span>
        )}
        {task.due_date && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            {new Date(task.due_date).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>
    </div>
  );
}

function BoardCard({ task, projectById, onOpen, isDragging = false, suppressClick }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
    data: { type: "task", task },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => {
        if (suppressClick.current) return;
        onOpen(task.id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (suppressClick.current) return;
          onOpen(task.id);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open task: ${task.title}`}
      className={[
        "group flex w-full cursor-grab items-start gap-1 rounded-lg border bg-card text-left shadow-sm transition-shadow hover:shadow-md touch-manipulation active:cursor-grabbing outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDragging ? "opacity-40" : "",
        `priority-border-${task.priority}`,
      ].join(" ")}
    >
      <div className="mt-3 ml-1 shrink-0 p-0.5 text-muted-foreground/40 pointer-events-none">
        <GripVertical className="h-4 w-4" />
      </div>
      <BoardCardContent task={task} projectById={projectById} />
    </div>
  );
}

function BoardCardOverlay({ task, projectById }) {
  return (
    <div
      className={`w-[300px] rounded-lg border bg-card text-left shadow-lg ring-2 ring-primary/30 priority-border-${task.priority}`}
    >
      <div className="flex items-start gap-1">
        <div className="mt-3 ml-1 p-0.5 text-muted-foreground/50">
          <GripVertical className="h-4 w-4" />
        </div>
        <BoardCardContent task={task} projectById={projectById} />
      </div>
    </div>
  );
}

function BoardColumn({ statusKey, tasks, customByKey, projectById, onOpen, activeTaskId, suppressClick }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${statusKey}`,
    data: { type: "column", statusKey },
  });

  const label = columnLabel(statusKey, customByKey);
  const accent = columnAccent(statusKey, customByKey);

  return (
    <div
      ref={setNodeRef}
      className={[
        "flex h-full flex-none flex-col rounded-xl border p-2 transition-colors",
        isOver ? "border-primary/50 bg-primary/5" : "border-transparent bg-transparent",
      ].join(" ")}
      style={{ width: COLUMN_WIDTH, minWidth: COLUMN_WIDTH, maxWidth: COLUMN_WIDTH }}
    >
      <div className="mb-2 shrink-0 rounded-lg border bg-card px-3 py-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: accent }}
          />
          <h3 className="text-sm font-semibold truncate">{label}</h3>
          <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
            {tasks.length}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground pl-4">
          {tasks.length === 1 ? "1 task" : `${tasks.length} tasks`}
        </p>
      </div>

      <div
        className={[
          "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-lg border p-2",
          isOver ? "border-primary/40 bg-primary/5" : "border-border/70 bg-muted/25",
        ].join(" ")}
      >
        {tasks.length === 0 ? (
          <div className="flex min-h-[140px] flex-1 items-center justify-center rounded-md border border-dashed border-border/60 bg-background/60 px-3 py-6 text-center pointer-events-none">
            <p className="text-xs text-muted-foreground">Drop tasks here</p>
          </div>
        ) : (
          tasks.map((task) => (
            <BoardCard
              key={task.id}
              task={task}
              projectById={projectById}
              onOpen={onOpen}
              isDragging={activeTaskId === task.id}
              suppressClick={suppressClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function BoardView({
  grouped,
  allStatusKeys,
  customByKey,
  projectById,
  onOpen,
  onStatusChange,
}) {
  const [activeId, setActiveId] = useState(null);
  const suppressClick = useRef(false);

  const columns = useMemo(
    () => visibleStatusKeys(allStatusKeys, grouped),
    [allStatusKeys, grouped],
  );

  const taskById = useMemo(() => {
    const map = new Map();
    for (const list of Object.values(grouped)) {
      for (const t of list) map.set(t.id, t);
    }
    return map;
  }, [grouped]);

  const activeTask = activeId ? taskById.get(activeId) : null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
  );

  const totalTasks = useMemo(
    () => Object.values(grouped).reduce((n, list) => n + list.length, 0),
    [grouped],
  );

  async function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);

    const taskId = String(active.id);
    const task = taskById.get(taskId);
    if (!task) return;

    const targetStatusKey = resolveDropTarget(over, taskById);
    if (!targetStatusKey) return;

    const currentKey = statusKeyForTask(task);
    if (currentKey === targetStatusKey) return;

    suppressClick.current = true;
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 100);

    try {
      await onStatusChange(taskId, statusPayload(targetStatusKey));
    } catch (err) {
      toast.error(err?.data?.error ?? err?.data?.detail ?? "Could not update status");
    }
  }

  if (totalTasks === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-16 text-center">
        <p className="text-sm font-medium">No tasks match the current filters</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Try updating or clearing your filters to see tasks on the board.
        </p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      measuring={{
        droppable: { strategy: MeasuringStrategy.Always },
      }}
      onDragStart={(e) => {
        setActiveId(String(e.active.id));
        suppressClick.current = true;
      }}
      onDragCancel={() => {
        setActiveId(null);
        window.setTimeout(() => {
          suppressClick.current = false;
        }, 100);
      }}
      onDragEnd={handleDragEnd}
    >
      <div className="board-shell flex h-[calc(100dvh-15.5rem)] min-h-[420px] flex-col">
        <div className="board-scroll flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain">
          <div
            className="flex h-full gap-3 pb-2 pr-1"
            style={{ width: "max-content", minWidth: "100%" }}
          >
            {columns.map((statusKey) => (
              <BoardColumn
                key={statusKey}
                statusKey={statusKey}
                tasks={grouped[statusKey] ?? []}
                customByKey={customByKey}
                projectById={projectById}
                onOpen={onOpen}
                activeTaskId={activeId}
                suppressClick={suppressClick}
              />
            ))}
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: "ease-out" }}>
        {activeTask ? (
          <BoardCardOverlay task={activeTask} projectById={projectById} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
