import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button.jsx";

export function CalendarView({ month, setMonth, tasks, projectById, customByKey, onOpen }) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(year, m, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, m, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const byDay = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      if (!t.due_date) continue;
      const d = new Date(t.due_date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      (map[key] ||= []).push(t);
    }
    return map;
  }, [tasks]);

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const monthLabel = month.toLocaleString(undefined, { month: "long", year: "numeric" });
  const noDue = tasks.filter((t) => !t.due_date);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-medium">{monthLabel}</div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setMonth(new Date(year, m - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(new Date(year, m + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-xs text-muted-foreground border-b">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-2 py-1.5 font-medium">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 border rounded-lg overflow-hidden bg-card">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="min-h-[110px] border-r border-b bg-muted/30 last-of-type:border-r-0" />;
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          const items = byDay[key] ?? [];
          const isToday = key === todayKey;
          return (
            <div key={i} className="min-h-[110px] border-r border-b p-1.5 flex flex-col gap-1 last-of-type:border-r-0">
              <div className={`text-xs ${isToday ? "inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                {d.getDate()}
              </div>
              <div className="flex flex-col gap-1 overflow-hidden">
                {items.slice(0, 4).map((t) => {
                  const cs = t.custom_status_key ? customByKey[`custom:${t.custom_status_key}`] : null;
                  const proj = t.project_id ? projectById[t.project_id] : null;
                  const dot = cs?.color ?? proj?.color ?? "var(--primary)";
                  return (
                    <button
                      key={t.id}
                      onClick={() => onOpen(t.id)}
                      title={t.title}
                      className={`text-left text-[11px] truncate rounded px-1.5 py-0.5 bg-accent/60 hover:bg-accent inline-flex items-center gap-1 priority-border-${t.priority}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: dot }} />
                      <span className="truncate">{t.title}</span>
                    </button>
                  );
                })}
                {items.length > 4 && (
                  <span className="text-[10px] text-muted-foreground px-1">+{items.length - 4} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {noDue.length > 0 && (
        <div className="border rounded-lg bg-card p-4">
          <div className="text-sm font-medium mb-2">No due date <span className="text-muted-foreground font-normal">({noDue.length})</span></div>
          <div className="flex flex-wrap gap-1.5">
            {noDue.slice(0, 20).map((t) => (
              <button
                key={t.id}
                onClick={() => onOpen(t.id)}
                className={`text-[11px] rounded-md border px-2 py-1 hover:bg-accent priority-border-${t.priority}`}
              >
                {t.title}
              </button>
            ))}
            {noDue.length > 20 && (
              <span className="text-[11px] text-muted-foreground px-2 py-1">+{noDue.length - 20} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
