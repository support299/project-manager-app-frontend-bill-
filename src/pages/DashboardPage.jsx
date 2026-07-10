import { Link } from "react-router-dom";
import { Folder, ArrowLeft, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { useGetDashboardStatsQuery } from "@/api/dashboardApi.js";
import { useSession } from "@/hooks/useSession.js";

export function DashboardPage() {
  const session = useSession();
  const locId = session.ghlLocationId;
  const skip = !session.loaded || (session.locationLocked && !locId);

  const { data, isLoading, isError } = useGetDashboardStatsQuery(
    locId ? { location_id: locId } : {},
    { skip },
  );

  const stats = data?.stats ?? {
    total: 0,
    done: 0,
    archived: 0,
    cancelled: 0,
    in_progress: 0,
    overdue: 0,
    completion: 0,
  };
  const statusBuckets = data?.status_buckets ?? [];
  const priorityBuckets = data?.priority_buckets ?? [];
  const projectPerf = data?.project_performance ?? [];
  const assigneePerf = data?.assignee_performance ?? [];

  const loading = !session.loaded || (!skip && isLoading);

  return (
    <div className="min-h-screen">
      <main className="w-full px-4 py-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                to="/"
                className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Tasks
              </Link>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Project status & team performance.</p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : isError ? (
          <p className="text-sm text-destructive">Failed to load dashboard stats.</p>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <KPI label="Total tasks" value={stats.total} />
              <KPI
                label="Completed"
                value={stats.done + (stats.archived ?? 0)}
                icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              />
              <KPI
                label="In progress"
                value={stats.in_progress}
                icon={<Clock className="h-4 w-4 text-blue-600" />}
              />
              <KPI
                label="Overdue"
                value={stats.overdue}
                icon={<AlertCircle className="h-4 w-4 text-red-600" />}
              />
              <KPI label="Completion rate" value={`${stats.completion}%`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="border rounded-lg bg-card p-5">
                <h2 className="font-medium mb-4">Tasks by status</h2>
                <div className="space-y-2.5">
                  {statusBuckets.map((b) => {
                    const pct = stats.total === 0 ? 0 : Math.round((b.count / stats.total) * 100);
                    return (
                      <div key={b.key}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ background: b.color ?? "var(--muted-foreground)" }}
                            />
                            {b.label}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {b.count} · {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: b.color ?? "var(--primary)" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="border rounded-lg bg-card p-5">
                <h2 className="font-medium mb-4">Tasks by priority</h2>
                <div className="space-y-2.5">
                  {priorityBuckets.map((b) => {
                    const pct = stats.total === 0 ? 0 : Math.round((b.count / stats.total) * 100);
                    const color =
                      b.key === "urgent"
                        ? "#dc2626"
                        : b.key === "high"
                          ? "#eab308"
                          : b.key === "medium"
                            ? "#fde68a"
                            : "#94a3b8";
                    return (
                      <div key={b.key}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                            {b.label}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {b.count} · {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            <section className="border rounded-lg bg-card">
              <div className="px-5 py-3 border-b">
                <h2 className="font-medium">Project performance</h2>
              </div>
              {projectPerf.length === 0 ? (
                <p className="text-sm text-muted-foreground p-5">No projects yet.</p>
              ) : (
                <div className="divide-y">
                  {projectPerf.map((p) => (
                    <div key={p.project.id} className="p-4 grid grid-cols-12 gap-3 items-center text-sm">
                      <div className="col-span-12 md:col-span-4 inline-flex items-center gap-2 min-w-0">
                        {p.project.color ? (
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ background: p.project.color }}
                          />
                        ) : (
                          <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="font-medium truncate">{p.project.title}</span>
                      </div>
                      <div className="col-span-12 md:col-span-5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>
                            {p.done}/{p.total} done
                          </span>
                          <span>{p.completion}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${p.completion}%`, background: p.project.color ?? "var(--primary)" }}
                          />
                        </div>
                      </div>
                      <div className="col-span-6 md:col-span-1 text-xs">
                        <span className="inline-flex items-center gap-1 text-blue-600">
                          <Clock className="h-3 w-3" />
                          {p.in_progress}
                        </span>
                      </div>
                      <div className="col-span-6 md:col-span-2 text-xs justify-self-end">
                        {p.overdue > 0 && (
                          <span className="inline-flex items-center gap-1 text-red-600">
                            <AlertCircle className="h-3 w-3" />
                            {p.overdue} overdue
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="border rounded-lg bg-card">
              <div className="px-5 py-3 border-b">
                <h2 className="font-medium">Top assignees</h2>
              </div>
              {assigneePerf.length === 0 ? (
                <p className="text-sm text-muted-foreground p-5">No assigned tasks yet.</p>
              ) : (
                <div className="divide-y">
                  {assigneePerf.map((a) => {
                    const pct = a.total === 0 ? 0 : Math.round((a.done / a.total) * 100);
                    return (
                      <div key={a.name} className="p-4 grid grid-cols-12 gap-3 items-center text-sm">
                        <div className="col-span-12 md:col-span-4 font-medium truncate">{a.name}</div>
                        <div className="col-span-12 md:col-span-5">
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>
                              {a.done}/{a.total} done
                            </span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <div className="col-span-12 md:col-span-3 text-xs justify-self-end">
                          {a.overdue > 0 && (
                            <span className="inline-flex items-center gap-1 text-red-600">
                              <AlertCircle className="h-3 w-3" />
                              {a.overdue} overdue
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function KPI({ label, value, icon }) {
  return (
    <div className="border rounded-lg bg-card p-4">
      <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
