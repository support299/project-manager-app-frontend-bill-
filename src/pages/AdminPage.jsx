import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { Button } from "@/components/ui/Button.jsx";
import { Input } from "@/components/ui/Input.jsx";
import { Label } from "@/components/ui/Label.jsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/Dialog.jsx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/Collapsible.jsx";
import {
  useGetLocationsQuery,
  useCreateLocationMutation,
  useUpdateLocationMutation,
  useDeleteLocationMutation,
  useTestLocationMutation,
  useSyncLocationUsersMutation,
  useSyncAllLocationUsersMutation,
  useLazyGetSyncAllLocationUsersStatusQuery,
  useGetLocationUsersQuery,
} from "@/api/locationsApi.js";
import { baseApi } from "@/api/baseApi.js";
import {
  useCreateStatusMutation,
  useUpdateStatusMutation,
  useDeleteStatusMutation,
} from "@/api/statusesApi.js";
import { useCustomStatuses } from "@/hooks/useCustomStatuses.js";
import { STATUSES, STATUS_LABEL } from "@/theme/status.js";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Eye, EyeOff, Link2, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useSession } from "@/hooks/useSession.js";

function errMsg(err) {
  return err?.data?.errors?.[0] ?? err?.data?.detail ?? err?.message ?? "Request failed";
}

export function AdminPage() {
  const dispatch = useDispatch();
  const session = useSession();
  const [openAdd, setOpenAdd] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncTaskId, setSyncTaskId] = useState(null);
  const pollRef = useRef(null);
  const [syncAllLocationUsers, { isLoading: isStartingSyncAll }] = useSyncAllLocationUsersMutation();
  const [fetchSyncStatus] = useLazyGetSyncAllLocationUsersStatusQuery();
  const { data: locations = [], isLoading, refetch } = useGetLocationsQuery(undefined, {
    skip: !session.loaded,
  });

  const syncingAll = Boolean(syncTaskId) || isStartingSyncAll;

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function finishSyncAll(r) {
    setSyncResult(r);
    setSyncTaskId(null);
    dispatch(baseApi.util.invalidateTags([{ type: "User", id: "LIST" }]));
    refetch();
    const failed = r.failed ?? 0;
    if (failed > 0) {
      toast.warning(
        `Synced ${r.succeeded}/${r.total_locations} locations — ${failed} failed. See details.`,
      );
    } else {
      toast.success(
        `Synced all ${r.total_locations} locations: ${r.total_users_synced} users, ${r.total_contacts_synced} contacts`,
      );
    }
  }

  async function pollSyncStatus(taskId) {
    try {
      const r = await fetchSyncStatus(taskId).unwrap();
      if (r.status === "success") {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        finishSyncAll(r);
      } else if (r.status === "failure") {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setSyncTaskId(null);
        toast.error(r.error || "Sync all failed");
      }
    } catch {
      // keep polling on transient errors
    }
  }

  async function syncAll() {
    try {
      const r = await syncAllLocationUsers().unwrap();
      if (r.queued && r.task_id) {
        toast.info("Sync started in background. This may take several minutes.");
        setSyncTaskId(r.task_id);
        await pollSyncStatus(r.task_id);
        pollRef.current = setInterval(() => pollSyncStatus(r.task_id), 5000);
        return;
      }
      finishSyncAll(r);
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight mb-1">Locations</h1>
            <p className="text-sm text-muted-foreground">Manage your sub-accounts.</p>
          </div>
          <div className="flex gap-2">
            {locations.length > 0 && (
              <Button size="sm" variant="outline" onClick={syncAll} disabled={syncingAll}>
                <RefreshCw className={`h-4 w-4 mr-1 ${syncingAll ? "animate-spin" : ""}`} />
                {syncingAll ? "Syncing all…" : "Sync all users"}
              </Button>
            )}
            {syncingAll && syncTaskId && (
              <p className="text-xs text-muted-foreground self-center max-w-[140px]">
                Running in background. You can keep this page open.
              </p>
            )}
            <Button size="sm" variant="outline" asChild>
              <Link to="/connect">
                <Link2 className="h-4 w-4 mr-1" />
                Connect GHL
              </Link>
            </Button>
            <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add location
              </Button>
            </DialogTrigger>
            <AddLocationDialog
              onAdded={() => {
                setOpenAdd(false);
                refetch();
              }}
            />
          </Dialog>
          </div>
        </div>

        {!session.loaded || isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : locations.length === 0 ? (
          <div className="border rounded-lg bg-card p-8 text-center space-y-4">
            <p className="text-sm text-muted-foreground">No locations yet.</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button size="sm" asChild>
                <Link to="/connect">
                  <Link2 className="h-4 w-4 mr-1" />
                  Connect via GHL OAuth
                </Link>
              </Button>
              <Button size="sm" variant="outline" onClick={() => setOpenAdd(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add with PIT token
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {locations.map((loc) => (
              <LocationRow key={loc.id} loc={loc} onChange={refetch} />
            ))}
          </div>
        )}
      </main>

      <SyncAllResultsDialog result={syncResult} onClose={() => setSyncResult(null)} />
    </div>
  );
}

function SyncAllResultsDialog({ result, onClose }) {
  const [showAll, setShowAll] = useState(false);
  if (!result) return null;

  const failures = (result.results ?? []).filter((r) => !r.ok);
  const successes = (result.results ?? []).filter((r) => r.ok);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Sync all users — results</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md border p-3">
            <div className="text-muted-foreground text-xs">Locations</div>
            <div className="font-semibold">
              {result.succeeded}/{result.total_locations} succeeded
            </div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-muted-foreground text-xs">Failed</div>
            <div className={`font-semibold ${result.failed > 0 ? "text-destructive" : ""}`}>
              {result.failed}
            </div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-muted-foreground text-xs">Users synced</div>
            <div className="font-semibold">{result.total_users_synced}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-muted-foreground text-xs">Contacts synced</div>
            <div className="font-semibold">{result.total_contacts_synced}</div>
          </div>
        </div>

        {failures.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-destructive">Failed locations ({failures.length})</p>
            <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
              {failures.map((r) => (
                <div key={r.id} className="px-3 py-2 text-sm">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.location_id}</div>
                  <div className="text-xs text-destructive mt-0.5">{r.error}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {successes.length > 0 && (
          <div className="space-y-2">
            <button
              type="button"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? "Hide" : "Show"} successful locations ({successes.length})
            </button>
            {showAll && (
              <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                {successes.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{r.location_id}</div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      {r.users_synced} users · {r.contacts_synced} contacts
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddLocationDialog({ onAdded }) {
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState("");
  const [pitToken, setPitToken] = useState("");
  const [createLocation, { isLoading: submitting }] = useCreateLocationMutation();

  async function submit() {
    if (!name.trim() || !locationId.trim() || !pitToken.trim()) return;
    try {
      await createLocation({
        name: name.trim(),
        location_id: locationId.trim(),
        pit_token: pitToken.trim(),
      }).unwrap();
      toast.success("Location added");
      setName("");
      setLocationId("");
      setPitToken("");
      onAdded();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add location</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Display name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My agency" />
        </div>
        <div className="space-y-1.5">
          <Label>Location ID</Label>
          <Input
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            placeholder="abc123…"
            className="font-mono text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Private Integration Token</Label>
          <Input
            type="password"
            value={pitToken}
            onChange={(e) => setPitToken(e.target.value)}
            placeholder="pit-…"
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">Create one in Settings → Private Integrations.</p>
        </div>
      </div>
      <DialogFooter>
        <Button
          onClick={submit}
          disabled={submitting || !name.trim() || !locationId.trim() || !pitToken.trim()}
        >
          {submitting ? "Saving…" : "Add location"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function LocationRow({ loc, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [name, setName] = useState(loc.name);
  const [locationId, setLocationId] = useState(loc.location_id);
  const [pitToken, setPitToken] = useState(loc.pit_token);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [updateLocation] = useUpdateLocationMutation();
  const [deleteLocation] = useDeleteLocationMutation();
  const [testLocation] = useTestLocationMutation();

  useEffect(() => {
    setName(loc.name);
    setLocationId(loc.location_id);
    setPitToken(loc.pit_token);
  }, [loc]);

  async function save() {
    setSaving(true);
    try {
      await updateLocation({ id: loc.id, name, location_id: locationId, pit_token: pitToken }).unwrap();
      toast.success("Saved");
      onChange();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTesting(true);
    try {
      const r = await testLocation(loc.id).unwrap();
      if (r.ok) toast.success(`Connected: ${r.location?.name ?? r.location?.id}`);
      else toast.error(r.error || "Connection failed");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setTesting(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete location "${loc.name}"?`)) return;
    try {
      await deleteLocation(loc.id).unwrap();
      toast.success("Deleted");
      onChange();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded} className="border rounded-lg bg-card">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between p-4 text-left hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="font-medium">{loc.name}</span>
            {loc.oauth_connected && (
              <span className="text-[10px] uppercase tracking-wide bg-green-100 text-green-800 px-1.5 py-0.5 rounded">
                OAuth
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground font-mono truncate max-w-[40%]">{loc.location_id}</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 space-y-3 border-t">
        <div className="grid grid-cols-2 gap-3 pt-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Display name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Location ID</Label>
            <Input
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{loc.oauth_connected ? "PIT Token (optional)" : "PIT Token"}</Label>
          <div className="flex gap-2">
            <Input
              type={showToken ? "text" : "password"}
              value={pitToken}
              onChange={(e) => setPitToken(e.target.value)}
              className="font-mono text-sm"
            />
            <Button variant="outline" size="icon" onClick={() => setShowToken((v) => !v)} type="button">
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="outline" onClick={runTest} disabled={testing}>
              {testing ? "Testing…" : "Test connection"}
            </Button>
          </div>
          <Button size="sm" variant="ghost" onClick={remove} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>

        <LocationUsers locationRowId={loc.id} />
        <LocationStatuses locationId={loc.location_id} />
      </CollapsibleContent>
    </Collapsible>
  );
}

function LocationStatuses({ locationId }) {
  const { statuses, reload } = useCustomStatuses(locationId);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColor, setEditColor] = useState("#3b82f6");

  const [createStatus] = useCreateStatusMutation();
  const [updateStatus] = useUpdateStatusMutation();
  const [deleteStatus] = useDeleteStatusMutation();

  function slugify(s) {
    return (
      s
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 40) || `s_${Date.now()}`
    );
  }

  async function add() {
    if (!label.trim()) return;
    const key = slugify(label);
    try {
      await createStatus({
        location_id: locationId,
        key,
        label: label.trim(),
        color,
        position: statuses.length,
      }).unwrap();
      setLabel("");
      setColor("#3b82f6");
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  async function saveEdit(id) {
    try {
      await updateStatus({ id, label: editLabel.trim(), color: editColor }).unwrap();
      setEditingId(null);
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  async function remove(id) {
    if (!confirm("Delete this status? Tasks using it will fall back to To do.")) return;
    try {
      await deleteStatus(id).unwrap();
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  return (
    <div className="border-t pt-3 mt-3 space-y-3">
      <div className="text-sm font-medium">Statuses</div>

      <div className="space-y-1">
        <div className="text-xs text-muted-foreground mb-1">Built-in (cannot be edited)</div>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <span key={s} className={`status-pill status-${s}`}>
              {STATUS_LABEL[s]}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Custom statuses</div>
        {statuses.length === 0 && <p className="text-xs text-muted-foreground">No custom statuses yet.</p>}
        {statuses.map((cs) => (
          <div key={cs.id} className="flex items-center gap-2 border rounded-md px-2 py-1.5">
            {editingId === cs.id ? (
              <>
                <input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="h-7 w-7 rounded cursor-pointer border"
                />
                <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="h-8 flex-1" />
                <Button size="sm" onClick={() => saveEdit(cs.id)}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <span className="h-4 w-4 rounded-full shrink-0" style={{ background: cs.color }} />
                <span className="flex-1 text-sm">{cs.label}</span>
                <span className="text-xs text-muted-foreground font-mono">{cs.key}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(cs.id);
                    setEditLabel(cs.label);
                    setEditColor(cs.color);
                  }}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(cs.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-9 w-9 rounded cursor-pointer border"
        />
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Add a status (e.g. Blocked)"
          className="h-9 flex-1"
        />
        <Button size="sm" onClick={add} disabled={!label.trim()}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add
        </Button>
      </div>
    </div>
  );
}

function LocationUsers({ locationRowId }) {
  const { data: users = [], isLoading: loading, refetch } = useGetLocationUsersQuery(locationRowId);
  const [syncLocationUsers, { isLoading: syncing }] = useSyncLocationUsersMutation();

  async function sync() {
    try {
      const r = await syncLocationUsers({ id: locationRowId }).unwrap();
      const users = r.users_synced ?? r.synced ?? 0;
      const contacts = r.contacts_synced ?? 0;
      toast.success(`Synced ${users} user${users === 1 ? "" : "s"} and ${contacts} contact${contacts === 1 ? "" : "s"}`);
      refetch();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  return (
    <div className="border-t pt-3 mt-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-1.5 text-sm font-medium">
          <Users className="h-4 w-4" /> Users{" "}
          <span className="text-muted-foreground font-normal">({users.length})</span>
        </div>
        <Button size="sm" variant="outline" onClick={sync} disabled={syncing}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync from GHL"}
        </Button>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : users.length === 0 ? (
        <p className="text-xs text-muted-foreground">No users yet. Click &quot;Sync users&quot; to pull them in.</p>
      ) : (
        <div className="border rounded-md divide-y">
          {users.map((u) => (
            <div key={u.ghl_id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{u.name ?? u.ghl_id}</div>
                {u.email && <div className="text-xs text-muted-foreground truncate">{u.email}</div>}
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-md border ${
                  u.role === "admin"
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "bg-muted text-muted-foreground"
                }`}
                title="Role is auto-detected on sync"
              >
                {u.role === "admin" ? "Admin" : "User"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
