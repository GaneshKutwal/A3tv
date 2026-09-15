import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Check, ChevronsUpDown, UserRound, Barcode } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ENGINEERS,
  ISSUE_TYPES,
  useAuth,
  useData,
  warrantyIsActive,
  type ComplaintPriority,
} from "@/lib/data";

export const Route = createFileRoute("/_app/complaints/new")({
  head: () => ({
    meta: [
      { title: "Register Complaint — A3 Television Service Desk" },
      { name: "description", content: "Register a new service complaint against an A3 Television serial number or customer name." },
      { property: "og:title", content: "Register Complaint — A3 Television Service Desk" },
      { property: "og:description", content: "Register a new service complaint against an A3 Television serial number or customer name." },
    ],
  }),
  component: NewComplaintPage,
});

type RegistrationMode = "serial" | "customer";

function NewComplaintPage() {
  const { warranties, fetchWarranties, addComplaint } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<RegistrationMode>("serial");
  const [submitting, setSubmitting] = useState(false);

  // Serial-number mode state
  const [open, setOpen] = useState(false);
  const [serialNo, setSerialNo] = useState("");

  // Customer-name mode state
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");

  // Shared state
  const [alternatePhone, setAlternatePhone] = useState("");
  const [issueType, setIssueType] = useState("");
  const [priority, setPriority] = useState<ComplaintPriority | "">("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [description, setDescription] = useState("");

  // Load warranties so the serial-number dropdown is populated
  useEffect(() => {
    fetchWarranties();
  }, []);

  const warranty = useMemo(
    () => warranties.find((w) => w.serialNo === serialNo),
    [warranties, serialNo]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "serial") {
      if (!serialNo || !issueType || !priority || !description.trim()) {
        toast.error("Fill in serial number, issue type, priority and description");
        return;
      }
      if (!warranty) {
        toast.error("Selected serial number has no warranty record");
        return;
      }
    } else {
      if (!customerName.trim() || !phone.trim() || !issueType || !priority || !description.trim()) {
        toast.error("Fill in customer name, phone, issue type, priority and description");
        return;
      }
    }

    const formData = new FormData();

    if (mode === "serial") {
      formData.append("warrantyId", warranty!.id);
      formData.append("serialNumber", serialNo);
    } else {
      formData.append("customerName", customerName.trim());
      formData.append("phone", phone.trim());
    }

    if (alternatePhone.trim()) {
      formData.append("alternatePhone", alternatePhone.trim());
    }
    // Combine issueType + description into description for the backend
    formData.append("description", `${issueType}\n${description.trim()}`);
    formData.append("priority", priority.toUpperCase());
    if (assignedTo) formData.append("assignedTo", assignedTo);
    formData.append("loggedBy", user ?? "Service Desk");

    try {
      setSubmitting(true);
      const complaint = await addComplaint(formData);
      toast.success(`Complaint ${complaint.id} registered`);
      navigate({ to: "/complaints" });
    } catch {
      // Error already toasted inside addComplaint
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full items-start justify-center overflow-hidden p-4 lg:p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="grid w-full max-w-4xl gap-4 lg:grid-cols-5"
      >
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Complaint Details</CardTitle>

            {/* ── Mode toggle ── */}
            <div className="mt-2 flex rounded-lg border bg-muted/30 p-1 gap-1">
              <button
                type="button"
                id="mode-by-serial"
                onClick={() => setMode("serial")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-all ${
                  mode === "serial"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Barcode className="h-3.5 w-3.5" />
                By Serial Number
              </button>
              <button
                type="button"
                id="mode-by-customer"
                onClick={() => setMode("customer")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-all ${
                  mode === "customer"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <UserRound className="h-3.5 w-3.5" />
                By Customer Name
              </button>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* ── Serial Number mode ── */}
              {mode === "serial" && (
                <div className="space-y-2">
                  <Label>Serial number *</Label>
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between font-normal">
                        {serialNo || "Search serial number…"}
                        <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Type serial, model or customer…" />
                        <CommandList>
                          <CommandEmpty>No matching serial number.</CommandEmpty>
                          <CommandGroup>
                            {warranties.map((w) => (
                              <CommandItem
                                key={w.id}
                                value={`${w.serialNo} ${w.model} ${w.customerName}`}
                                onSelect={() => {
                                  setSerialNo(w.serialNo);
                                  setOpen(false);
                                }}
                              >
                                <Check className={`h-4 w-4 ${serialNo === w.serialNo ? "opacity-100" : "opacity-0"}`} />
                                <span className="font-medium">{w.serialNo}</span>
                                <span className="ml-2 truncate text-xs text-muted-foreground">
                                  {w.model} · {w.customerName}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* ── Customer Name mode ── */}
              {mode === "customer" && (
                <div className="space-y-3">
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                    Serial number unknown — you can link it later once identified.
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customerName">Customer name *</Label>
                      <Input
                        id="customerName"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="e.g. Ramesh Patil"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone number *</Label>
                      <Input
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. 98220 55667"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Issue type *</Label>
                  <Select value={issueType} onValueChange={setIssueType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select issue" />
                    </SelectTrigger>
                    <SelectContent>
                      {ISSUE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority *</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as ComplaintPriority)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="alternatePhone">Alternate mobile number</Label>
                  <Input
                    id="alternatePhone"
                    value={alternatePhone}
                    onChange={(e) => setAlternatePhone(e.target.value)}
                    placeholder="e.g. 98220 55667 (optional)"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Assign engineer (optional)</Label>
                  <Select value={assignedTo} onValueChange={setAssignedTo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Assign later" />
                    </SelectTrigger>
                    <SelectContent>
                      {ENGINEERS.map((e) => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue reported by the customer…"
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => navigate({ to: "/complaints" })}>
                  Cancel
                </Button>
                <Button type="submit" className="glow-primary" disabled={submitting}>
                  {submitting ? "Registering…" : "Register Complaint"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ── Right panel: unit info or customer preview ── */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">
              {mode === "serial" ? "Unit Information" : "Customer Information"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mode === "serial" ? (
              warranty ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Serial</span>
                    <span className="font-medium">{warranty.serialNo}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Model</span>
                    <span>{warranty.model}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Customer</span>
                    <span>{warranty.customerName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Primary Phone</span>
                    <span>{warranty.phone}</span>
                  </div>
                  {alternatePhone.trim() && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Alt Phone</span>
                      <span className="font-medium text-foreground">{alternatePhone.trim()}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Warranty</span>
                    {warrantyIsActive(warranty) ? (
                      <Badge variant="outline" className="border-success/40 bg-success/15 text-success">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="border-destructive/40 bg-destructive/15 text-destructive">Expired</Badge>
                    )}
                  </div>
                  <p className="pt-2 text-xs text-muted-foreground">
                    Logged by: <span className="text-foreground">{user}</span> (phone intake)
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a serial number to see the customer and warranty details for that unit.
                </p>
              )
            ) : (
              customerName.trim() || phone.trim() ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Customer</span>
                    <span className="font-medium">{customerName || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Phone</span>
                    <span>{phone || "—"}</span>
                  </div>
                  {alternatePhone.trim() && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Alt Phone</span>
                      <span className="font-medium">{alternatePhone.trim()}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Serial</span>
                    <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      Pending
                    </Badge>
                  </div>
                  <p className="pt-2 text-xs text-muted-foreground">
                    Logged by: <span className="text-foreground">{user}</span> (phone intake)
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Enter customer name and phone to preview details. The serial number can be linked later.
                </p>
              )
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
