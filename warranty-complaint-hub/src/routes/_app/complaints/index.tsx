import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";
import { Search, CalendarIcon, CheckCircle2, FileSpreadsheet, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ENGINEERS,
  useAuth,
  useData,
  type Complaint,
  type ComplaintPriority,
  type ComplaintStatus,
} from "@/lib/data";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateRange } from "react-day-picker";
import { downloadCsv } from "@/lib/csv-export";

export const Route = createFileRoute("/_app/complaints/")({
  head: () => ({
    meta: [
      { title: "Complaints — A3 Television Service Desk" },
      { name: "description", content: "Track, update, and resolve A3 Television service complaints." },
      { property: "og:title", content: "Complaints — A3 Television Service Desk" },
      { property: "og:description", content: "Track, update, and resolve A3 Television service complaints." },
    ],
  }),
  component: ComplaintsPage,
});

const STATUS_TABS = ["All", "Open", "In Progress", "Resolved"] as const;

function ComplaintsPage() {
  const { complaints, updateComplaint, resolveComplaint, fetchComplaints } = useData();
  const { user } = useAuth();
  const [tab, setTab] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<DateRange | undefined>();
  const [editing, setEditing] = useState<Complaint | null>(null);
  const [resolving, setResolving] = useState<Complaint | null>(null);

  useEffect(() => {
    fetchComplaints();
  }, []);

  // edit form state
  const [editStatus, setEditStatus] = useState<ComplaintStatus>("Open");
  const [editPriority, setEditPriority] = useState<ComplaintPriority>("Low");
  const [editAssignee, setEditAssignee] = useState<string>("");
  const [editNote, setEditNote] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");

  const filtered = useMemo(() => {
    return complaints.filter((c) => {
      if (tab !== "All" && c.status !== tab) return false;
      if (query) {
        const q = query.toLowerCase();
        const w = `${c.serialNo} ${c.id} ${c.issueType} ${c.loggedBy} ${c.assignedTo ?? ""}`.toLowerCase();
        if (!w.includes(q)) return false;
      }
      if (range?.from) {
        const created = new Date(c.createdAt);
        if (created < range.from) return false;
        if (range.to) {
          const end = new Date(range.to);
          end.setHours(23, 59, 59, 999);
          if (created > end) return false;
        }
      }
      return true;
    });
  }, [complaints, tab, query, range]);

  const exportComplaints = () => {
    downloadCsv(
      `complaints-${format(new Date(), "yyyy-MM-dd")}.csv`,
      ["Complaint ID", "Serial No", "Issue", "Description", "Priority", "Logged By", "Assigned To", "Created", "Status", "Resolved At", "Resolution Note"],
      filtered.map((c) => [
        c.id,
        c.serialNo,
        c.issueType,
        c.description,
        c.priority,
        c.loggedBy,
        c.assignedTo ?? "",
        format(new Date(c.createdAt), "yyyy-MM-dd"),
        c.status,
        c.resolvedAt ? format(new Date(c.resolvedAt), "yyyy-MM-dd") : "",
        c.resolutionNote ?? "",
      ]),
    );
  };

  const openEdit = (c: Complaint) => {
    setEditing(c);
    setEditStatus(c.status);
    setEditPriority(c.priority);
    setEditAssignee(c.assignedTo ?? "");
    setEditNote("");
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (editing.status === "Resolved") {
      toast.error("Resolved complaints cannot be updated");
      setEditing(null);
      return;
    }
    try {
      await updateComplaint(
        editing.id,
        {
          status: editStatus,
          priority: editPriority,
          assignedTo: editAssignee || null,
        },
        editNote,
        user ?? "Service Desk",
      );
      toast.success(`${editing.id} updated`);
    } catch {
      // Error already toasted
    }
    setEditing(null);
  };

  const saveResolve = async () => {
    if (!resolving) return;
    if (!resolutionNote.trim()) {
      toast.error("Add a resolution note");
      return;
    }
    try {
      await resolveComplaint(resolving.id, resolutionNote.trim(), user ?? "Service Desk");
      toast.success(`${resolving.id} resolved`);
    } catch {
      // Error already toasted
    }
    setResolving(null);
    setResolutionNote("");
  };

  const counts = {
    All: complaints.length,
    Open: complaints.filter((c) => c.status === "Open").length,
    "In Progress": complaints.filter((c) => c.status === "In Progress").length,
    Resolved: complaints.filter((c) => c.status === "Resolved").length,
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4 lg:p-6">
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            {STATUS_TABS.map((s) => (
              <TabsTrigger key={s} value={s} className="gap-1.5">
                {s}
                <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
                  {counts[s]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search serial, ID, engineer…"
            className="w-64 pl-9"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 font-normal">
              <CalendarIcon className="h-4 w-4" />
              {range?.from
                ? range.to
                  ? `${format(range.from, "dd MMM yy")} – ${format(range.to, "dd MMM yy")}`
                  : format(range.from, "dd MMM yyyy")
                : "Created date range"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={2} />
          </PopoverContent>
        </Popover>
        {(query || range?.from) && (
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => { setQuery(""); setRange(undefined); }}>
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
        <Button variant="outline" size="sm" className="gap-2" onClick={exportComplaints} disabled={!filtered.length}>
          <FileSpreadsheet className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="min-h-0 flex-1 rounded-lg border border-border">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>Complaint</TableHead>
                <TableHead>Serial No</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Logged By</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.id}</TableCell>
                  <TableCell>{c.serialNo}</TableCell>
                  <TableCell>{c.issueType}</TableCell>
                  <TableCell><PriorityBadge priority={c.priority} /></TableCell>
                  <TableCell className="text-muted-foreground">{c.loggedBy}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.assignedTo ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(c.createdAt), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {c.status !== "Resolved" && (
                        <Button variant="ghost" size="sm" className="gap-1" onClick={() => openEdit(c)}>
                          <Pencil className="h-3.5 w-3.5" /> Update
                        </Button>
                      )}
                      {c.status !== "Resolved" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-success hover:text-success"
                          onClick={() => {
                            setResolving(c);
                            setResolutionNote("");
                          }}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    No complaints match.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {/* Update dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update {editing?.id}</DialogTitle>
            <DialogDescription>
              {editing?.serialNo} · {editing?.issueType}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as ComplaintStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={editPriority} onValueChange={(v) => setEditPriority(v as ComplaintPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Assigned engineer</Label>
              <Select value={editAssignee} onValueChange={setEditAssignee}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  {ENGINEERS.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-note">Add note</Label>
              <Textarea
                id="edit-note"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="e.g. Spare part ordered, visit scheduled…"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve dialog */}
      <Dialog open={!!resolving} onOpenChange={(o) => !o && setResolving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve {resolving?.id}</DialogTitle>
            <DialogDescription>
              {resolving?.serialNo} · {resolving?.issueType}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="resolution-note">Resolution note *</Label>
            <Textarea
              id="resolution-note"
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="What was done to fix the issue?"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResolving(null)}>Cancel</Button>
            <Button onClick={saveResolve}>Mark resolved</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
