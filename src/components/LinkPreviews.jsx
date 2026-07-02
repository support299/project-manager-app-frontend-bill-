import { ExternalLink, FileText, Link as LinkIcon } from "lucide-react";

const URL_RE = /https?:\/\/[^\s<>"')]+/gi;

function extractUrls(text) {
  if (!text) return [];
  const matches = text.match(URL_RE) ?? [];
  return Array.from(new Set(matches.map((u) => u.replace(/[.,;:!?)]+$/, ""))));
}

function describe(url) {
  try {
    const u = new URL(url);
    const segs = u.pathname.split("/").filter(Boolean);
    const last = segs[segs.length - 1] ?? u.hostname;
    const looksLikeDoc =
      /\/(documents?|download|files?|attachments?)\//i.test(u.pathname) ||
      /\.(pdf|docx?|xlsx?|pptx?|csv|txt|png|jpe?g|gif|webp|zip|mp4|mov|mp3)$/i.test(u.pathname);
    return { label: decodeURIComponent(last), host: u.hostname, isFile: looksLikeDoc };
  } catch {
    return { label: url, host: url, isFile: false };
  }
}

export function LinkPreviews({ text }) {
  const urls = extractUrls(text);
  if (urls.length === 0) return null;

  return (
    <div className="mt-2 space-y-1.5">
      {urls.map((url) => {
        const { label, host, isFile } = describe(url);
        const Icon = isFile ? FileText : LinkIcon;
        return (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-md border bg-card px-3 py-2 hover:bg-accent transition-colors"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{label}</div>
              <div className="truncate text-xs text-muted-foreground">{host}</div>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
          </a>
        );
      })}
    </div>
  );
}
