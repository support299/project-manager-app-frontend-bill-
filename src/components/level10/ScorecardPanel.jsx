import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateLevel10MeasurableMutation,
  useUpdateLevel10MeasurableMutation,
  useDeleteLevel10MeasurableMutation,
  useUpsertLevel10MeasurableValueMutation,
} from "@/api/level10Api.js";
import {
  buildScorecardMonthColumns,
  buildScorecardWeekColumns,
  buildScorecardYearArchive,
  filterColumnsForCadence,
  filterScorecardColumnsByRange,
  findMonthlyValue,
  indexMeasurableValues,
  parseOccurrenceDate,
  sameScorecardDay,
  scorecardArchiveYears,
  scorecardCellStatus,
  scorecardQuarterFromDate,
  scorecardSumAvg,
  scorecardWinRate,
  scorecardYearOptions,
  formatScorecardWeekRangeLabel,
} from "@/utils/level10.js";
import { Button } from "@/components/ui/Button.jsx";
import { Input } from "@/components/ui/Input.jsx";
import { Textarea } from "@/components/ui/Textarea.jsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select.jsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog.jsx";

const SCORECARD_CADENCE_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
];

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function stickyColClasses(wide) {
  if (wide) {
    return {
      ownerH: "sticky left-0 z-30 w-[120px] min-w-[120px] max-w-[120px] bg-muted px-2 py-2 text-left font-semibold",
      metricH: "sticky left-[120px] z-30 w-[280px] min-w-[280px] max-w-[280px] bg-muted px-2 py-2 text-left font-semibold",
      goalH: "sticky left-[400px] z-30 w-[88px] min-w-[88px] max-w-[88px] bg-emerald-100 dark:bg-emerald-950 px-1.5 py-2 text-center font-semibold text-emerald-800 dark:text-emerald-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]",
      ownerC: "sticky left-0 z-20 w-[120px] min-w-[120px] max-w-[120px] bg-card px-2 py-1.5 align-middle",
      metricC: "sticky left-[120px] z-20 w-[280px] min-w-[280px] max-w-[280px] bg-card px-2 py-1.5 align-middle overflow-hidden",
      goalC: "sticky left-[400px] z-20 w-[88px] min-w-[88px] max-w-[88px] bg-card px-1.5 py-1.5 align-middle text-center shadow-[2px_0_4px_-2px_rgba(0,0,0,0.12)]",
    };
  }
  return {
    ownerH: "sticky left-0 z-30 w-[100px] min-w-[100px] max-w-[100px] bg-muted px-2 py-2 text-left font-semibold",
    metricH: "sticky left-[100px] z-30 w-[160px] min-w-[160px] max-w-[160px] bg-muted px-2 py-2 text-left font-semibold",
    goalH: "sticky left-[260px] z-30 w-[76px] min-w-[76px] max-w-[76px] bg-emerald-100 dark:bg-emerald-950 px-1.5 py-2 text-center font-semibold text-emerald-800 dark:text-emerald-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]",
    ownerC: "sticky left-0 z-20 w-[100px] min-w-[100px] max-w-[100px] bg-card px-2 py-1.5 align-middle",
    metricC: "sticky left-[100px] z-20 w-[160px] min-w-[160px] max-w-[160px] bg-card px-2 py-1.5 align-middle overflow-hidden",
    goalC: "sticky left-[260px] z-20 w-[76px] min-w-[76px] max-w-[76px] bg-card px-1.5 py-1.5 align-middle text-center shadow-[2px_0_4px_-2px_rgba(0,0,0,0.12)]",
  };
}

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

function formatScorecardNum(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const num = Number(n);
  if (Number.isInteger(num)) return String(num);
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function cellTone(status) {
  if (status === "on") return "bg-emerald-500/25 border-emerald-500/40 text-emerald-900 dark:text-emerald-100";
  if (status === "off") return "bg-destructive/20 border-destructive/40 text-destructive";
  return "bg-background border-border";
}

function resolveWeekActual(valueMap, colKey) {
  if (!valueMap) return { actual: null, key: colKey };
  const row = valueMap.get(colKey);
  if (row) return { actual: row.actual ?? null, key: colKey };
  for (const [k, v] of valueMap) {
    if (sameScorecardDay(k, colKey)) return { actual: v.actual ?? null, key: k };
  }
  return { actual: null, key: colKey };
}

function ScorecardCellInput({ valueKey, actual, status, disabled, onCommit }) {
  return (
    <Input
      defaultValue={actual == null ? "" : String(actual)}
      key={valueKey}
      disabled={disabled}
      onBlur={(e) => {
        const cur = actual == null ? "" : String(actual);
        if (e.target.value !== cur) onCommit(e.target.value);
      }}
      placeholder="—"
      inputMode="decimal"
      className={`h-8 w-[4.75rem] mx-auto text-center text-xs tabular-nums px-1 border ${cellTone(status)} ${disabled ? "opacity-40" : ""}`}
    />
  );
}

function WeeklyMetricsTable({
  wide,
  weeklyMeasurables,
  visibleWeekColumns,
  occurrenceKey,
  isHost,
  editingId,
  editOwner,
  setEditOwner,
  editName,
  setEditName,
  editCadence,
  setEditCadence,
  editGoal,
  setEditGoal,
  rowWeekPoints,
  rowStats,
  setActual,
  setDetailMetric,
  renderMetricActions,
}) {
  const sticky = stickyColClasses(wide);

  if (weeklyMeasurables.length === 0) {
    return (
      <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground text-center">
        No weekly metrics yet — add one below (cadence Weekly or Biweekly).
      </div>
    );
  }

  return (
    <div className="max-w-full h-full overflow-auto overscroll-contain rounded-md border bg-card [-webkit-overflow-scrolling:touch]">
      <table className="w-max text-sm border-separate border-spacing-0">
        <thead>
          <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
            <th className={sticky.ownerH}>Owner</th>
            <th className={sticky.metricH}>Success Metrics</th>
            <th className={sticky.goalH}>Goal/Week</th>
            {visibleWeekColumns.map((col) => (
              <th
                key={col.key}
                className={`relative z-0 px-1 py-2 text-center font-semibold min-w-[4.75rem] bg-muted ${
                  sameScorecardDay(col.key, occurrenceKey) ? "text-primary" : ""
                }`}
                title={col.date.toLocaleDateString()}
              >
                <div className="normal-case tracking-normal font-semibold text-[11px] leading-tight">
                  {col.rangeLabel}
                </div>
                <div className="font-normal normal-case tracking-normal opacity-60 text-[10px]">
                  W{col.weekNum}
                </div>
              </th>
            ))}
            <th className="relative z-0 px-2 py-2 text-center font-semibold min-w-[4.25rem] bg-muted">Average</th>
            <th className="relative z-0 px-2 py-2 text-center font-semibold min-w-[4.25rem] bg-muted">Total</th>
            <th className="relative z-0 px-2 py-2 text-center font-semibold min-w-[4.25rem] bg-muted">Win %</th>
            {isHost && <th className="relative z-0 px-2 py-2 w-24 bg-muted" />}
          </tr>
        </thead>
        <tbody>
          {weeklyMeasurables.map((m) => {
            const isEditing = editingId === m.id;
            const points = rowWeekPoints(m);
            const stats = rowStats(points, m.goal);

            return (
              <tr key={m.id} className="border-b last:border-0">
                <td className={sticky.ownerC}>
                  {isEditing ? (
                    <Input value={editOwner} onChange={(e) => setEditOwner(e.target.value)} placeholder="Owner" className="h-8 max-w-full" />
                  ) : (
                    <span className="block truncate text-sm font-medium" title={m.owner || undefined}>
                      {m.owner || "—"}
                    </span>
                  )}
                </td>
                <td className={sticky.metricC}>
                  {isEditing ? (
                    <div className="space-y-1.5 max-w-full">
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 max-w-full" />
                      <Select value={editCadence} onValueChange={setEditCadence}>
                        <SelectTrigger className="h-8 text-xs max-w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SCORECARD_CADENCE_OPTIONS.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={`block w-full max-w-full text-left font-medium hover:text-primary ${wide ? "whitespace-normal break-words" : "truncate"}`}
                      title={m.name}
                      onClick={() => setDetailMetric(m)}
                    >
                      {m.name}
                      {(m.cadence || "weekly") === "biweekly" && (
                        <span className="ml-1 text-[10px] uppercase text-muted-foreground">Bi</span>
                      )}
                    </button>
                  )}
                </td>
                <td className={sticky.goalC}>
                  {isEditing ? (
                    <Input
                      value={editGoal}
                      onChange={(e) => setEditGoal(e.target.value)}
                      placeholder="Goal"
                      inputMode="decimal"
                      className="h-8 bg-emerald-500/10 text-center max-w-full px-1"
                    />
                  ) : (
                    <span
                      className="inline-block max-w-full truncate text-sm font-semibold tabular-nums bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 px-1.5 py-1 rounded"
                      title={m.goal == null ? undefined : String(m.goal)}
                    >
                      {m.goal == null ? "—" : formatScorecardNum(m.goal)}
                    </span>
                  )}
                </td>
                {!isEditing && points.map((p) => (
                  <td
                    key={`${m.id}-${p.key}`}
                    className={`relative z-0 px-1 py-1.5 text-center align-middle bg-card ${p.isCurrent ? "bg-primary/5" : ""}`}
                  >
                    <ScorecardCellInput
                      valueKey={`${m.id}-w-${p.key}-${p.actual ?? ""}`}
                      actual={p.actual}
                      status={p.status}
                      disabled={!p.active}
                      onCommit={(raw) => setActual(m, p.key, raw)}
                    />
                  </td>
                ))}
                {isEditing && visibleWeekColumns.map((col) => (
                  <td key={`edit-spacer-${col.key}`} className="relative z-0 px-1 py-1.5 bg-card" />
                ))}
                <td className="relative z-0 px-2 py-1.5 text-center tabular-nums text-sm font-medium text-muted-foreground bg-card">
                  {formatScorecardNum(stats.avg)}
                </td>
                <td className="relative z-0 px-2 py-1.5 text-center tabular-nums text-sm font-semibold bg-card">
                  {formatScorecardNum(stats.sum)}
                </td>
                <td className="relative z-0 px-2 py-1.5 text-center tabular-nums text-sm font-medium bg-card">
                  {stats.win == null ? "—" : `${formatScorecardNum(stats.win)}%`}
                </td>
                {isHost && (
                  <td className="relative z-0 px-2 py-1.5 align-middle bg-card">
                    {renderMetricActions(m, isEditing)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ScorecardPanel({
  eventId,
  event,
  occurrenceKey,
  measurables,
  values,
  isHost,
  users,
}) {
  const meetingDate = useMemo(
    () => parseOccurrenceDate(occurrenceKey) || new Date(),
    [occurrenceKey],
  );
  const meetingYear = meetingDate.getFullYear();
  const meetingQuarter = scorecardQuarterFromDate(meetingDate);

  const [viewYear, setViewYear] = useState(meetingYear);
  const [weekRange, setWeekRange] = useState(String(meetingQuarter));
  const [historyMetricId, setHistoryMetricId] = useState(null);

  const [newName, setNewName] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [newCadence, setNewCadence] = useState("weekly");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editGoal, setEditGoal] = useState("");
  const [editName, setEditName] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [editCadence, setEditCadence] = useState("weekly");
  const [detailMetric, setDetailMetric] = useState(null);
  const [detailNotes, setDetailNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [expandedOpen, setExpandedOpen] = useState(false);

  const [createMeasurable] = useCreateLevel10MeasurableMutation();
  const [updateMeasurable] = useUpdateLevel10MeasurableMutation();
  const [deleteMeasurableMut] = useDeleteLevel10MeasurableMutation();
  const [upsertValue] = useUpsertLevel10MeasurableValueMutation();

  const valuesByMeasurable = useMemo(() => indexMeasurableValues(values), [values]);

  const yearOptions = useMemo(
    () => scorecardYearOptions(event, values),
    [event, values],
  );

  const yearWeekColumns = useMemo(
    () => buildScorecardWeekColumns(event, viewYear, values),
    [event, viewYear, values],
  );

  const visibleWeekColumns = useMemo(() => {
    if (weekRange === "year") {
      return yearWeekColumns.map((col, i) => ({
        ...col,
        weekNum: i + 1,
        rangeLabel: formatScorecardWeekRangeLabel(col.date),
      }));
    }
    const filtered = filterScorecardColumnsByRange(yearWeekColumns, Number(weekRange));
    return filtered.map((col) => {
      const idx = yearWeekColumns.findIndex((c) => c.key === col.key);
      return {
        ...col,
        weekNum: idx + 1,
        rangeLabel: formatScorecardWeekRangeLabel(col.date),
      };
    });
  }, [yearWeekColumns, weekRange]);

  const monthColumns = useMemo(() => buildScorecardMonthColumns(viewYear), [viewYear]);

  const weeklyMeasurables = useMemo(
    () => measurables.filter((m) => (m.cadence || "weekly") !== "monthly"),
    [measurables],
  );
  const monthlyMeasurables = useMemo(
    () => measurables.filter((m) => m.cadence === "monthly"),
    [measurables],
  );

  const archiveYears = useMemo(
    () => scorecardArchiveYears(event, values, 10),
    [event, values],
  );

  const liveDetail = useMemo(
    () => (detailMetric ? measurables.find((m) => m.id === detailMetric.id) || detailMetric : null),
    [detailMetric, measurables],
  );

  const historyMetric = useMemo(() => {
    if (!measurables.length) return null;
    if (historyMetricId) {
      return measurables.find((m) => m.id === historyMetricId) || measurables[0];
    }
    return monthlyMeasurables[0] || weeklyMeasurables[0] || measurables[0];
  }, [measurables, historyMetricId, monthlyMeasurables, weeklyMeasurables]);

  const historyArchiveRows = useMemo(() => {
    if (!historyMetric) return [];
    return buildScorecardYearArchive({
      measurable: historyMetric,
      valuesByMeasurable,
      years: archiveYears,
    });
  }, [historyMetric, valuesByMeasurable, archiveYears]);

  useEffect(() => {
    if (!detailMetric) return;
    if (!measurables.some((m) => m.id === detailMetric.id)) setDetailMetric(null);
  }, [measurables, detailMetric]);

  useEffect(() => {
    if (liveDetail) setDetailNotes(liveDetail.notes || "");
  }, [liveDetail?.id, liveDetail?.notes]);

  useEffect(() => {
    setViewYear(meetingYear);
    setWeekRange(String(meetingQuarter));
  }, [meetingYear, meetingQuarter, occurrenceKey]);

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
        cadence: newCadence,
        sort_order: measurables.length,
      }).unwrap();
      setNewName("");
      setNewOwner("");
      setNewGoal("");
      setNewCadence("weekly");
      toast.success("Measurable added");
    } catch (err) {
      toast.error(apiError(err, "Failed to add measurable"));
    } finally {
      setAdding(false);
    }
  }

  async function setActual(m, periodKey, raw) {
    const num = raw.trim() === "" ? null : Number(raw);
    if (num !== null && Number.isNaN(num)) return toast.error("Actual must be a number");
    try {
      await upsertValue({
        eventId,
        measurableId: m.id,
        occurrence_key: periodKey,
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
    setEditCadence(m.cadence || "weekly");
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
        cadence: editCadence,
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
      if (detailMetric?.id === m.id) setDetailMetric(null);
      if (historyMetricId === m.id) setHistoryMetricId(null);
      toast.success("Measurable deleted");
    } catch (err) {
      toast.error(apiError(err, "Failed to delete measurable"));
    }
  }

  async function saveNotes() {
    if (!liveDetail) return;
    if (!isHost) return toast.error("Only meeting hosts can edit notes");
    setSavingNotes(true);
    try {
      await updateMeasurable({
        eventId,
        measurableId: liveDetail.id,
        occurrence_key: occurrenceKey,
        notes: detailNotes.trim() || null,
      }).unwrap();
      toast.success("Notes saved");
    } catch (err) {
      toast.error(apiError(err, "Failed to save notes"));
    } finally {
      setSavingNotes(false);
    }
  }

  function rowWeekPoints(m) {
    const cadence = m.cadence || "weekly";
    const valueMap = valuesByMeasurable.get(m.id);
    const activeCols = filterColumnsForCadence(yearWeekColumns, visibleWeekColumns, cadence, event);
    const activeKeys = new Set(activeCols.map((c) => c.key));

    return visibleWeekColumns.map((col) => {
      const active = cadence === "weekly" || activeKeys.has(col.key);
      if (!active) {
        return {
          key: col.key,
          actual: null,
          status: "none",
          active: false,
          isCurrent: sameScorecardDay(col.key, occurrenceKey),
        };
      }
      const { actual, key } = resolveWeekActual(valueMap, col.key);
      return {
        key,
        actual,
        status: scorecardCellStatus(actual, m.goal),
        active: true,
        isCurrent: sameScorecardDay(col.key, occurrenceKey),
      };
    });
  }

  function rowStats(points, goal) {
    const nums = points.filter((p) => p.active).map((p) => p.actual);
    const { sum, avg } = scorecardSumAvg(nums);
    const win = scorecardWinRate(
      points.filter((p) => p.active).map((p) => ({ actual: p.actual })),
      goal,
    );
    return { sum, avg, win };
  }

  function renderMetricActions(m, isEditing) {
    if (!isHost) return null;
    if (isEditing) {
      return (
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" className="h-7 text-xs" onClick={() => saveEdit(m)}>Save</Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-end gap-0.5">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(m)} title="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => deleteMeasurable(m)}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs px-1.5" onClick={() => setDetailMetric(m)}>
          Notes
        </Button>
      </div>
    );
  }

  const rangeTitle = weekRange === "year" ? `Weeks 1–${yearWeekColumns.length || 52} · ${viewYear}` : `Q${weekRange} ${viewYear}`;
  const stickyCompact = stickyColClasses(false);

  const weeklyTableProps = {
    weeklyMeasurables,
    visibleWeekColumns,
    occurrenceKey,
    isHost,
    editingId,
    editOwner,
    setEditOwner,
    editName,
    setEditName,
    editCadence,
    setEditCadence,
    editGoal,
    setEditGoal,
    rowWeekPoints,
    rowStats,
    setActual,
    setDetailMetric,
    renderMetricActions,
  };

  return (
    <div className="p-4 md:p-6 space-y-6 min-w-0 max-w-full overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Scorecard</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Weekly success metrics · goals · averages · totals · history
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(viewYear)} onValueChange={(v) => setViewYear(Number(v))}>
            <SelectTrigger className="h-9 w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={weekRange} onValueChange={setWeekRange}>
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Q1 weeks</SelectItem>
              <SelectItem value="2">Q2 weeks</SelectItem>
              <SelectItem value="3">Q3 weeks</SelectItem>
              <SelectItem value="4">Q4 weeks</SelectItem>
              <SelectItem value="year">Weeks 1–52</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-9 w-9 shrink-0"
            title="Expand scorecard"
            onClick={() => setExpandedOpen(true)}
            disabled={weeklyMeasurables.length === 0}
          >
            <Maximize2 className="h-4 w-4" />
            <span className="sr-only">Expand scorecard</span>
          </Button>
        </div>
      </div>

      {/* —— Weekly Success Metrics (sheet top) —— */}
      <section className="space-y-2 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Weekly Success Metrics · {rangeTitle}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {weeklyMeasurables.length > 0 && visibleWeekColumns.length > 4 && (
              <div className="text-[11px] text-muted-foreground hidden sm:block">Scroll → for more weeks</div>
            )}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              title="Expand full screen"
              onClick={() => setExpandedOpen(true)}
              disabled={weeklyMeasurables.length === 0}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <WeeklyMetricsTable wide={false} {...weeklyTableProps} />
      </section>

      {/* Full-screen weekly metrics */}
      <Dialog open={expandedOpen} onOpenChange={setExpandedOpen}>
        <DialogContent className="fixed inset-3 left-3 top-3 right-3 bottom-3 z-50 flex h-auto max-h-none w-auto max-w-none translate-x-0 translate-y-0 flex-col gap-3 overflow-hidden p-4 sm:rounded-xl">
          <DialogHeader className="shrink-0 pr-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <DialogTitle>Weekly Success Metrics</DialogTitle>
                <DialogDescription>{rangeTitle} · edit cells here · Esc or close to exit</DialogDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={String(viewYear)} onValueChange={(v) => setViewYear(Number(v))}>
                  <SelectTrigger className="h-9 w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={weekRange} onValueChange={setWeekRange}>
                  <SelectTrigger className="h-9 w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Q1 weeks</SelectItem>
                    <SelectItem value="2">Q2 weeks</SelectItem>
                    <SelectItem value="3">Q3 weeks</SelectItem>
                    <SelectItem value="4">Q4 weeks</SelectItem>
                    <SelectItem value="year">Weeks 1–52</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" variant="outline" onClick={() => setExpandedOpen(false)}>
                  <Minimize2 className="h-4 w-4 mr-1.5" />
                  Exit
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1">
            <WeeklyMetricsTable wide {...weeklyTableProps} />
          </div>
        </DialogContent>
      </Dialog>

      {/* —— Monthly Success Metrics (sheet middle) —— */}
      <section className="space-y-2 min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Monthly Success Metrics · {viewYear}
        </div>

        {monthlyMeasurables.length === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground text-center">
            No monthly metrics yet — add a measurable with cadence Monthly.
          </div>
        ) : (
          <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-md border bg-card [-webkit-overflow-scrolling:touch]">
            <table className="w-max text-sm border-separate border-spacing-0">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className={stickyCompact.ownerH}>Owner</th>
                  <th className={stickyCompact.metricH}>Success Metrics</th>
                  <th className={stickyCompact.goalH}>Goal</th>
                  {monthColumns.map((col) => {
                    const isCurrent = viewYear === meetingYear && col.month === meetingDate.getMonth();
                    return (
                      <th
                        key={col.key}
                        className={`relative z-0 px-1 py-2 text-center font-semibold min-w-[4.5rem] bg-muted ${isCurrent ? "text-primary" : ""}`}
                      >
                        {col.label}
                      </th>
                    );
                  })}
                  <th className="relative z-0 px-2 py-2 text-center font-semibold min-w-[4.5rem] bg-muted">Average</th>
                  <th className="relative z-0 px-2 py-2 text-center font-semibold min-w-[4.5rem] bg-muted">Total</th>
                  <th className="relative z-0 px-2 py-2 text-center font-semibold min-w-[4.5rem] bg-muted">Win %</th>
                  {isHost && <th className="relative z-0 px-2 py-2 w-24 bg-muted" />}
                </tr>
              </thead>
              <tbody>
                {monthlyMeasurables.map((m) => {
                  const isEditing = editingId === m.id;
                  const valueMap = valuesByMeasurable.get(m.id);
                  const points = monthColumns.map((col) => {
                    const row = findMonthlyValue(valueMap, viewYear, col.month);
                    const actual = row?.actual ?? null;
                    const isCurrent = viewYear === meetingYear && col.month === meetingDate.getMonth();
                    return {
                      key: row?.occurrence_key || col.key,
                      actual,
                      status: scorecardCellStatus(actual, m.goal),
                      isCurrent,
                    };
                  });
                  const stats = rowStats(
                    points.map((p) => ({ ...p, active: true })),
                    m.goal,
                  );

                  return (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className={stickyCompact.ownerC}>
                        {isEditing ? (
                          <Input value={editOwner} onChange={(e) => setEditOwner(e.target.value)} placeholder="Owner" className="h-8 max-w-full" />
                        ) : (
                          <span className="block truncate text-sm font-medium" title={m.owner || undefined}>
                            {m.owner || "—"}
                          </span>
                        )}
                      </td>
                      <td className={stickyCompact.metricC}>
                        {isEditing ? (
                          <div className="space-y-1.5 max-w-full">
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 max-w-full" />
                            <Select value={editCadence} onValueChange={setEditCadence}>
                              <SelectTrigger className="h-8 text-xs max-w-full"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {SCORECARD_CADENCE_OPTIONS.map((c) => (
                                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="block w-full max-w-full truncate text-left font-medium hover:text-primary"
                            title={m.name}
                            onClick={() => setDetailMetric(m)}
                          >
                            {m.name}
                          </button>
                        )}
                      </td>
                      <td className={stickyCompact.goalC}>
                        {isEditing ? (
                          <Input
                            value={editGoal}
                            onChange={(e) => setEditGoal(e.target.value)}
                            placeholder="Goal"
                            inputMode="decimal"
                            className="h-8 bg-emerald-500/10 text-center max-w-full px-1"
                          />
                        ) : (
                          <span
                            className="inline-block max-w-full truncate text-sm font-semibold tabular-nums bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 px-1.5 py-1 rounded"
                            title={m.goal == null ? undefined : String(m.goal)}
                          >
                            {m.goal == null ? "—" : formatScorecardNum(m.goal)}
                          </span>
                        )}
                      </td>
                      {!isEditing && points.map((p) => (
                        <td
                          key={`${m.id}-${p.key}`}
                          className={`relative z-0 px-1 py-1.5 text-center align-middle bg-card ${p.isCurrent ? "bg-primary/5" : ""}`}
                        >
                          <ScorecardCellInput
                            valueKey={`${m.id}-m-${p.key}-${p.actual ?? ""}`}
                            actual={p.actual}
                            status={p.status}
                            onCommit={(raw) => setActual(m, p.key, raw)}
                          />
                        </td>
                      ))}
                      {isEditing && monthColumns.map((col) => (
                        <td key={`edit-m-${col.key}`} className="relative z-0 px-1 py-1.5 bg-card" />
                      ))}
                      <td className="relative z-0 px-2 py-1.5 text-center tabular-nums text-sm font-medium text-muted-foreground bg-card">
                        {formatScorecardNum(stats.avg)}
                      </td>
                      <td className="relative z-0 px-2 py-1.5 text-center tabular-nums text-sm font-semibold bg-card">
                        {formatScorecardNum(stats.sum)}
                      </td>
                      <td className="relative z-0 px-2 py-1.5 text-center tabular-nums text-sm font-medium bg-card">
                        {stats.win == null ? "—" : `${formatScorecardNum(stats.win)}%`}
                      </td>
                      {isHost && (
                        <td className="relative z-0 px-2 py-1.5 align-middle bg-card">
                          {renderMetricActions(m, isEditing)}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* —— Multi-year history (sheet bottom) —— */}
      {measurables.length > 0 && (
        <section className="space-y-2 min-w-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              History · year archive
            </div>
            <Select
              value={historyMetric?.id || ""}
              onValueChange={setHistoryMetricId}
            >
              <SelectTrigger className="h-9 w-full sm:w-[260px]">
                <SelectValue placeholder="Select metric" />
              </SelectTrigger>
              <SelectContent>
                {measurables.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Multi-year monthly rollup for{" "}
            <span className="font-medium text-foreground">{historyMetric?.name}</span>
            {" "}— like the sheet bottom (avg, total, growth %).
          </p>
          <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-md border bg-card [-webkit-overflow-scrolling:touch]">
            <table className="w-max text-xs border-collapse">
              <thead>
                <tr className="uppercase tracking-wide text-muted-foreground border-b bg-muted/40">
                  <th className="px-2 py-2 text-left font-medium sticky left-0 bg-muted/40 z-10">Year</th>
                  {MONTH_SHORT.map((label) => (
                    <th key={label} className="px-1.5 py-2 text-center font-medium min-w-[3.25rem]">{label}</th>
                  ))}
                  <th className="px-2 py-2 text-right font-medium">Avg</th>
                  <th className="px-2 py-2 text-right font-medium">Total</th>
                  <th className="px-2 py-2 text-right font-medium">Growth %</th>
                </tr>
              </thead>
              <tbody>
                {historyArchiveRows.map((row) => (
                  <tr key={row.year} className="border-t hover:bg-muted/20">
                    <td className="px-2 py-1.5 font-semibold sticky left-0 bg-card z-10">{row.year}</td>
                    {row.months.map((val, mi) => (
                      <td
                        key={`${row.year}-${mi}`}
                        className={`px-1.5 py-1.5 text-center tabular-nums ${
                          val == null
                            ? "text-muted-foreground"
                            : historyMetric?.goal != null && Number(val) >= Number(historyMetric.goal)
                              ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                              : historyMetric?.goal != null
                                ? "bg-destructive/10 text-destructive"
                                : ""
                        }`}
                      >
                        {formatScorecardNum(val)}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                      {formatScorecardNum(row.avg)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                      {formatScorecardNum(row.sum)}
                    </td>
                    <td
                      className={`px-2 py-1.5 text-right tabular-nums ${
                        row.growthPct == null
                          ? "text-muted-foreground"
                          : row.growthPct >= 0
                            ? "text-emerald-600"
                            : "text-destructive"
                      }`}
                    >
                      {row.growthPct == null
                        ? "—"
                        : `${row.growthPct >= 0 ? "+" : ""}${formatScorecardNum(row.growthPct)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* —— Add measurable —— */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Add measurable
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_0.7fr_0.9fr_auto] gap-2">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Success metric name" />
          <Input value={newOwner} onChange={(e) => setNewOwner(e.target.value)} placeholder="Owner" list="scorecard-owners" />
          <datalist id="scorecard-owners">
            {users.map((u) => <option key={u.ghl_id} value={u.name || u.email || u.ghl_id} />)}
          </datalist>
          <Input value={newGoal} onChange={(e) => setNewGoal(e.target.value)} placeholder="Goal" inputMode="decimal" />
          <Select value={newCadence} onValueChange={setNewCadence}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Cadence" /></SelectTrigger>
            <SelectContent>
              {SCORECARD_CADENCE_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={addMeasurable} disabled={adding}>
            <Plus className="h-4 w-4 mr-1.5" />Add
          </Button>
        </div>
        {!isHost && (
          <p className="mt-3 text-xs text-muted-foreground">
            Anyone can add measurables and set actuals. Only meeting hosts can edit goals or delete measurables.
          </p>
        )}
      </div>

      <Dialog open={!!liveDetail} onOpenChange={(o) => { if (!o) setDetailMetric(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{liveDetail?.name || "Metric"}</DialogTitle>
            <DialogDescription>
              {liveDetail?.owner ? `${liveDetail.owner} · ` : ""}
              Goal {liveDetail?.goal == null ? "—" : formatScorecardNum(liveDetail.goal)}
              {" · "}
              <span className="capitalize">{liveDetail?.cadence || "weekly"}</span>
            </DialogDescription>
          </DialogHeader>
          {liveDetail && (
            <div className="space-y-3 mt-1">
              <Textarea
                value={detailNotes}
                onChange={(e) => setDetailNotes(e.target.value)}
                placeholder="Comments, context, follow-ups…"
                rows={5}
                disabled={!isHost}
              />
              {isHost && (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={saveNotes}
                    disabled={savingNotes || detailNotes === (liveDetail.notes || "")}
                  >
                    {savingNotes ? "Saving…" : "Save notes"}
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Edit week values in the scorecard grid. Use History below the grid for multi-year archive.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
