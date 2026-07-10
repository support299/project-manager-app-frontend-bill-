export const STATUSES = ["backlog", "todo", "in_progress", "review", "done", "archive", "cancelled"];

export const PRIORITIES = ["low", "medium", "high", "urgent"];

export const STATUS_LABEL = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  review: "Review",
  done: "Done",
  archive: "Archive",
  cancelled: "Cancelled",
};

export const PRIORITY_LABEL = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export function formatDuration(seconds) {
  if (!seconds || seconds < 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
