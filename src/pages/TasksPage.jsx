import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Search,
  User as UserIcon,
  Phone,
  Calendar,
  Folder,
  Pencil,
  Trash2,
  X,
  List,
  Columns3,
  CalendarDays,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  ListTree,
  Repeat,
} from "lucide-react";
import { useGetTasksQuery, useGetSubtasksListQuery, useUpdateTaskMutation } from "@/api/tasksApi.js";
import { useGetProjectsQuery, useDeleteProjectMutation } from "@/api/projectsApi.js";
import { useGetGhlUsersQuery } from "@/api/locationsApi.js";
import { Button } from "@/components/ui/Button.jsx";
import { Input } from "@/components/ui/Input.jsx";
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
import { NewTaskDialog } from "@/components/NewTaskDialog.jsx";
import { TaskDetail } from "@/components/TaskDetail.jsx";
import { ProjectDialog } from "@/components/ProjectDialog.jsx";
import { CalendarView } from "@/components/CalendarView.jsx";
import { BoardView } from "@/components/BoardView.jsx";
import { useSession } from "@/hooks/useSession.js";
import { useCustomStatuses } from "@/hooks/useCustomStatuses.js";
import { STATUSES, STATUS_LABEL, PRIORITIES, PRIORITY_LABEL } from "@/theme/status.js";

const ALL = "__all__";
const NONE = "__none__";
const LIST_COLLAPSE_KEY = "tasks-list-collapsed-statuses";

function loadCollapsedSet(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw != null) return new Set(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return new Set();
}

function persistCollapsedSet(storageKey, set) {
  try {
    localStorage.setItem(storageKey, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

export function TasksPage() {
  const session = useSession();
  const locId = session.ghlLocationId;
  const skip = !session.loaded || (session.locationLocked && !locId);
  const locationParams = locId ? { location_id: locId } : {};

  const { data: tasks = [], isLoading: tasksLoading, refetch: refetchTasks } = useGetTasksQuery(
    locationParams,
    { skip },
  );
  const { data: allSubtasks = [], isLoading: subtasksLoading } = useGetSubtasksListQuery(
    locationParams,
    { skip },
  );
  const { data: projects = [], refetch: refetchProjects } = useGetProjectsQuery(
    locationParams,
    { skip },
  );
  const { data: usersData } = useGetGhlUsersQuery(
    locationParams,
    { skip: skip || !locId },
  );
  const users = usersData?.users ?? [];

  const [deleteProjectMut] = useDeleteProjectMutation();
  const [updateTask] = useUpdateTaskMutation();
  const { statuses: customStatuses } = useCustomStatuses(locId);

  const [openNew, setOpenNew] = useState(false);
  const [openProject, setOpenProject] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [stack, setStack] = useState([]);
  const activeId = stack[stack.length - 1] ?? null;
  const [q, setQ] = useState("");
  const [view, setView] = useState("board");
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [fStatus, setFStatus] = useState(ALL);
  const [fPriority, setFPriority] = useState(ALL);
  const [fProject, setFProject] = useState(ALL);
  const [fAssignees, setFAssignees] = useState([]);
  const [fCreatedFrom, setFCreatedFrom] = useState("");
  const [fCreatedTo, setFCreatedTo] = useState("");
  const [fDueFrom, setFDueFrom] = useState("");
  const [fDueTo, setFDueTo] = useState("");
  const [expandedParents, setExpandedParents] = useState(() => new Set());
  const [collapsedListStatuses, setCollapsedListStatuses] = useState(() => loadCollapsedSet(LIST_COLLAPSE_KEY));

  function toggleListStatusCollapsed(statusKey) {
    setCollapsedListStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(statusKey)) next.delete(statusKey);
      else next.add(statusKey);
      persistCollapsedSet(LIST_COLLAPSE_KEY, next);
      return next;
    });
  }

  const loading = !session.loaded || (!skip && tasksLoading);

  const load = useCallback(() => {
    refetchTasks();
    refetchProjects();
  }, [refetchTasks, refetchProjects]);

  const filtersActive =
    fStatus !== ALL || fPriority !== ALL || fProject !== ALL ||
    fAssignees.length > 0 || fCreatedFrom || fCreatedTo || fDueFrom || fDueTo || q;

  function clearFilters() {
    setQ("");
    setFStatus(ALL);
    setFPriority(ALL);
    setFProject(ALL);
    setFAssignees([]);
    setFCreatedFrom("");
    setFCreatedTo("");
    setFDueFrom("");
    setFDueTo("");
  }

  const matchesFilters = useCallback((t) => {
    const lower = q.toLowerCase();
    if (q && !(
      (t.title || "").toLowerCase().includes(lower) ||
      (t.description || "").toLowerCase().includes(lower) ||
      (t.ghl_assignee_name || "").toLowerCase().includes(lower) ||
      (t.ghl_contact_name || "").toLowerCase().includes(lower)
    )) return false;
    const effectiveStatus = t.custom_status_key ? `custom:${t.custom_status_key}` : t.status;
    if (fStatus !== ALL && effectiveStatus !== fStatus) return false;
    if (fPriority !== ALL && t.priority !== fPriority) return false;
    if (fProject !== ALL) {
      if (fProject === NONE && t.project_id) return false;
      if (fProject !== NONE && t.project_id !== fProject) return false;
    }
    if (fAssignees.length > 0) {
      const ids = t.ghl_assignee_ids ?? [];
      if (!fAssignees.some((a) => ids.includes(a))) return false;
    }
    if (fCreatedFrom && new Date(t.created_at) < new Date(fCreatedFrom)) return false;
    if (fCreatedTo && new Date(t.created_at) > new Date(fCreatedTo + "T23:59:59")) return false;
    if (fDueFrom && (!t.due_date || new Date(t.due_date) < new Date(fDueFrom))) return false;
    if (fDueTo && (!t.due_date || new Date(t.due_date) > new Date(fDueTo + "T23:59:59"))) return false;
    return true;
  }, [q, fStatus, fPriority, fProject, fAssignees, fCreatedFrom, fCreatedTo, fDueFrom, fDueTo]);

  const grouped = useMemo(() => {
    const filtered = tasks.filter(matchesFilters);
    const map = {};
    for (const s of STATUSES) map[s] = [];
    for (const cs of customStatuses) map[`custom:${cs.key}`] = [];
    for (const t of filtered) {
      const key = t.custom_status_key ? `custom:${t.custom_status_key}` : t.status;
      (map[key] ||= []).push(t);
    }
    return map;
  }, [tasks, matchesFilters, customStatuses]);

  const allStatusKeys = useMemo(
    () => [...STATUSES, ...customStatuses.map((c) => `custom:${c.key}`)],
    [customStatuses],
  );
  const customByKey = useMemo(
    () => Object.fromEntries(customStatuses.map((c) => [`custom:${c.key}`, c])),
    [customStatuses],
  );

  const projectById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);

  const subtasksByParent = useMemo(() => {
    const map = new Map();
    for (const s of allSubtasks) {
      const pid = s.parent_task_id;
      if (!pid) continue;
      const arr = map.get(pid) || [];
      arr.push(s);
      map.set(pid, arr);
    }
    return map;
  }, [allSubtasks]);

  function toggleExpanded(taskId) {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  async function deleteProject(id) {
    if (!confirm("Delete this project? Tasks will be unassigned from it.")) return;
    await deleteProjectMut(id).unwrap();
    load();
  }

  const isBoard = view === "board";

  return (
    <div className="min-h-screen">
      <main
        className={`w-full px-4 py-4 grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]`}
      >
        <aside className="min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Projects</h2>
            <Button size="icon" variant="ghost" onClick={() => { setEditingProject(null); setOpenProject(true); }}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1">
            <button
              onClick={() => setFProject(ALL)}
              className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm ${fProject === ALL ? "bg-accent" : "hover:bg-accent/50"}`}
            >
              All tasks
            </button>
            <button
              onClick={() => setFProject(NONE)}
              className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm ${fProject === NONE ? "bg-accent" : "hover:bg-accent/50"}`}
            >
              No project
            </button>
            {projects.map((p) => (
              <div
                key={p.id}
                className={`group flex items-center gap-1 rounded-md text-sm ${fProject === p.id ? "bg-accent" : "hover:bg-accent/50"}`}
              >
                <button
                  onClick={() => setFProject(p.id)}
                  className="flex-1 text-left px-2.5 py-1.5 inline-flex items-center gap-1.5 min-w-0"
                >
                  {p.color ? (
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                  ) : (
                    <Folder className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate">{p.title}</span>
                </button>
                <button
                  onClick={() => { setEditingProject(p); setOpenProject(true); }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={() => deleteProject(p.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive mr-1"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {projects.length === 0 && (
              <p className="text-xs text-muted-foreground px-2.5 py-2">No projects yet.</p>
            )}
          </div>

          {fProject !== ALL && fProject !== NONE && projectById[fProject] && (
            <div className="mt-4 rounded-md border bg-card p-3 text-xs space-y-1">
              <div className="font-medium text-sm">{projectById[fProject].title}</div>
              {projectById[fProject].description && (
                <div className="text-muted-foreground">{projectById[fProject].description}</div>
              )}
              {projectById[fProject].due_date && (
                <div className="inline-flex items-center gap-1 text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Due {new Date(projectById[fProject].due_date).toLocaleDateString()}
                </div>
              )}
              {(projectById[fProject].ghl_assignee_names?.length ?? 0) > 0 && (
                <div className="inline-flex items-center gap-1 text-muted-foreground">
                  <UserIcon className="h-3 w-3" />
                  {projectById[fProject].ghl_assignee_names.join(", ")}
                </div>
              )}
            </div>
          )}
        </aside>

        <div className="min-w-0">
          <div className="flex items-end justify-between mb-4 gap-3 flex-wrap">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Tasks</h1>
              <p className="text-sm text-muted-foreground mt-1">A clean workspace for your product work.</p>
            </div>
            <div className="flex items-center gap-2">
              {session.isSuperAdmin && (
                <Link to="/admin">
                  <Button variant="outline" size="sm" className="h-9">
                    <Settings className="h-4 w-4 mr-1.5" />Admin
                  </Button>
                </Link>
              )}
              <Link to="/dashboard">
                <Button variant="outline" size="sm" className="h-9">
                  <BarChart3 className="h-4 w-4 mr-1.5" />Dashboard
                </Button>
              </Link>
              <div className="inline-flex rounded-md border bg-card p-0.5" role="group" aria-label="Task view">
                <button
                  type="button"
                  onClick={() => setView("board")}
                  title="Board view"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded ${view === "board" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Columns3 className="h-3.5 w-3.5" />Board
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  title="List view"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <List className="h-3.5 w-3.5" />List
                </button>
                <button
                  type="button"
                  onClick={() => setView("calendar")}
                  title="Calendar view"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded ${view === "calendar" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <CalendarDays className="h-3.5 w-3.5" />Calendar
                </button>
              </div>
              <Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-1.5" />New task</Button>
            </div>
          </div>

          <div className={`space-y-3 ${isBoard ? "mb-4" : "mb-6"}`}>
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks…" className="pl-9" />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <Select value={fStatus} onValueChange={setFStatus}>
                <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                  {customStatuses.map((cs) => (
                    <SelectItem key={cs.key} value={`custom:${cs.key}`}>{cs.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={fPriority} onValueChange={setFPriority}>
                <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All priorities</SelectItem>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}
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
                        {users.map((u) => {
                          const checked = fAssignees.includes(u.id);
                          return (
                            <CommandItem
                              key={u.id}
                              onSelect={() => setFAssignees(checked ? fAssignees.filter((x) => x !== u.id) : [...fAssignees, u.id])}
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

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9">
                    <Calendar className="h-3.5 w-3.5 mr-1.5" />
                    {fCreatedFrom || fCreatedTo ? "Created: set" : "Created date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-3 w-64 space-y-2">
                  <div>
                    <label className="text-xs text-muted-foreground">From</label>
                    <Input type="date" value={fCreatedFrom} onChange={(e) => setFCreatedFrom(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">To</label>
                    <Input type="date" value={fCreatedTo} onChange={(e) => setFCreatedTo(e.target.value)} />
                  </div>
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
          ) : view === "calendar" ? (
            <CalendarView
              month={calMonth}
              setMonth={setCalMonth}
              tasks={Object.values(grouped).flat()}
              projectById={projectById}
              customByKey={customByKey}
              onOpen={(id) => setStack([id])}
            />
          ) : view === "board" ? (
            <BoardView
              grouped={grouped}
              allStatusKeys={allStatusKeys}
              customByKey={customByKey}
              projectById={projectById}
              onOpen={(id) => setStack([id])}
              onStatusChange={(id, payload) => updateTask({ id, ...payload }).unwrap()}
            />
          ) : (
            <div className="space-y-8">
              {allStatusKeys.map((s) => {
                const list = grouped[s] ?? [];
                const cs = customByKey[s];
                const isCollapsed = collapsedListStatuses.has(s);
                return (
                  <section key={s}>
                    <button
                      type="button"
                      onClick={() => toggleListStatusCollapsed(s)}
                      className="flex w-full items-center gap-2 mb-3 rounded-md px-1 py-1 -ml-1 text-left hover:bg-muted/50 transition-colors"
                      aria-expanded={!isCollapsed}
                      title={isCollapsed ? "Expand section" : "Collapse section"}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      {cs ? (
                        <span
                          className="status-pill"
                          style={{ background: `${cs.color}20`, color: cs.color }}
                        >
                          {cs.label}
                        </span>
                      ) : (
                        <span className={`status-pill status-${s}`}>{STATUS_LABEL[s]}</span>
                      )}
                      <span className="text-xs text-muted-foreground">{list.length}</span>
                    </button>
                    {!isCollapsed && (
                    <div className="border rounded-lg bg-card divide-y">
                      {list.length === 0 ? (
                        <p className="px-4 py-6 text-sm text-muted-foreground text-center">No tasks</p>
                      ) : list.map((t) => {
                        const children = (subtasksByParent.get(t.id) || []).filter(matchesFilters);
                        const subtaskCount = t.subtask_count ?? children.length;
                        const hasChildren = subtaskCount > 0;
                        const isExpanded = expandedParents.has(t.id);
                        return (
                          <div key={t.id} className="group/task">
                            <div className={`flex items-stretch priority-border-${t.priority}`}>
                              <div className="flex w-9 shrink-0 items-center justify-center border-r bg-muted/30">
                                {hasChildren ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleExpanded(t.id)}
                                    className="flex h-full w-full items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
                                    aria-label={isExpanded ? "Collapse subtasks" : "Expand subtasks"}
                                    aria-expanded={isExpanded}
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </button>
                                ) : (
                                  <span className="h-4 w-4" />
                                )}
                              </div>
                              <TaskListRow
                                task={t}
                                projectById={projectById}
                                onOpen={() => setStack([t.id])}
                                badge={hasChildren ? (
                                  <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                    <ListTree className="h-3 w-3" />
                                    {subtaskCount}
                                  </span>
                                ) : null}
                              />
                            </div>
                            {hasChildren && isExpanded && (
                              subtasksLoading && children.length === 0 ? (
                                <p className="py-2 pl-12 text-xs text-muted-foreground">Loading subtasks…</p>
                              ) : (
                                children.map((sub) => (
                                  <TaskListRow
                                    key={sub.id}
                                    task={sub}
                                    projectById={projectById}
                                    onOpen={() => setStack([t.id, sub.id])}
                                    isSubtask
                                  />
                                ))
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <NewTaskDialog
        open={openNew}
        onOpenChange={setOpenNew}
        onCreated={load}
        projects={projects}
        defaultProjectId={fProject !== ALL && fProject !== NONE ? fProject : null}
      />
      <ProjectDialog
        open={openProject}
        onOpenChange={setOpenProject}
        onSaved={load}
        project={editingProject}
      />
      <TaskDetail
        taskId={activeId}
        onClose={() => setStack([])}
        onChange={load}
        onOpenTask={(id) => setStack((s) => [...s, id])}
        onBack={stack.length > 1 ? () => setStack((s) => s.slice(0, -1)) : undefined}
        projects={projects}
      />
    </div>
  );
}

function TaskListRow({ task, projectById, onOpen, isSubtask = false, badge = null }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex-1 text-left px-4 py-3 hover:bg-accent/40 transition-colors flex items-center justify-between gap-3 ${isSubtask ? "pl-6 bg-muted/25 border-l-2 border-l-primary/30 ml-9" : ""}`}
    >
      <div className="flex items-start gap-2 min-w-0 flex-1">
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate flex items-center gap-1.5">
            {isSubtask && <ListTree className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            {task.title}
            {badge}
            {task.recurrence && task.recurrence !== "none" && (
              <Repeat className="h-3 w-3 shrink-0 text-muted-foreground" />
            )}
          </div>
          {task.description ? (
            <div className="text-sm text-muted-foreground truncate">{task.description}</div>
          ) : null}
          <div className="flex flex-wrap gap-1 mt-1">
            {task.project_id && projectById[task.project_id] && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px]">
                <Folder className="h-3 w-3" />{projectById[task.project_id].title}
              </span>
            )}
            {task.labels?.map((l) => (
              <span key={l} className="rounded-full bg-accent px-2 py-0.5 text-[11px]">{l}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
        <span className="hidden sm:inline">{PRIORITY_LABEL[task.priority]}</span>
        {(task.ghl_assignee_names?.length ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1"><UserIcon className="h-3 w-3" />{task.ghl_assignee_names.join(", ")}</span>
        )}
        {task.ghl_contact_name && (
          <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{task.ghl_contact_name}</span>
        )}
        {task.due_date && (
          <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(task.due_date).toLocaleDateString()}</span>
        )}
      </div>
    </button>
  );
}
