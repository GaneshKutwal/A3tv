import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";
import { motion } from "motion/react";
import { Check, ChevronsUpDown, CircleDot, CheckCircle2, ClipboardPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useData, warrantyIsActive } from "@/lib/data";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";

export const Route = createFileRoute("/_app/complaints/history")({
  head: () => ({
    meta: [
      { title: "Complaint History — A3 Television Service Desk" },
      { name: "description", content: "Full service history timeline for any A3 Television serial number." },
      { property: "og:title", content: "Complaint History — A3 Television Service Desk" },
      { property: "og:description", content: "Full service history timeline for any A3 Television serial number." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { warranties, complaints, fetchWarranties, fetchComplaints } = useData();
  const [open, setOpen] = useState(false);
  const [serialNo, setSerialNo] = useState("");

  useEffect(() => {
    fetchWarranties();
    fetchComplaints();
  }, []);

  const warranty = warranties.find((w) => w.serialNo === serialNo);

  const history = useMemo(() => {
    return complaints
      .filter((c) => c.serialNo === serialNo)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [complaints, serialNo]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4 lg:p-6">
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-80 justify-between font-normal">
              {serialNo || "Search a serial number…"}
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
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
        {serialNo && (
          <p className="text-sm text-muted-foreground">
            {history.length} complaint{history.length === 1 ? "" : "s"} on record
          </p>
        )}
      </div>

      {!serialNo ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            Select a serial number to view its complete complaint history.
          </p>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-3">
          {/* Warranty card */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-sm">
                {warranty?.serialNo ?? serialNo}
                {warranty &&
                  (warrantyIsActive(warranty) ? (
                    <Badge variant="outline" className="border-success/40 bg-success/15 text-success">Active</Badge>
                  ) : (
                    <Badge variant="outline" className="border-destructive/40 bg-destructive/15 text-destructive">Expired</Badge>
                  ))}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {warranty ? (
                <>
                  <div className="flex justify-between"><span className="text-muted-foreground">Model</span><span>{warranty.model}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span>{warranty.customerName}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{warranty.phone}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Purchased</span><span>{format(new Date(warranty.purchaseDate), "dd MMM yyyy")}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Dealer</span><span>{warranty.dealerName}</span></div>
                </>
              ) : (
                <p className="text-muted-foreground">No warranty record found for this serial number.</p>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <div className="min-h-0 lg:col-span-2">
            <ScrollArea className="h-full pr-2">
              {history.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border">
                  <p className="text-sm text-muted-foreground">No complaints registered for this unit.</p>
                  <Link to="/complaints/new">
                    <Button variant="outline" size="sm" className="gap-2">
                      <ClipboardPlus className="h-4 w-4" /> Register complaint
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="relative space-y-4 pl-6 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-border">
                  {history.map((c, i) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.3 }}
                      className="relative"
                    >
                      <span className="absolute -left-6 top-4 flex h-4 w-4 items-center justify-center rounded-full bg-background">
                        {c.status === "Resolved" ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <CircleDot className="h-4 w-4 text-primary" />
                        )}
                      </span>
                      <Card>
                        <CardContent className="space-y-3 p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-display text-sm font-semibold">{c.id}</span>
                            <StatusBadge status={c.status} />
                            <PriorityBadge priority={c.priority} />
                            <span className="ml-auto text-xs text-muted-foreground">
                              {format(new Date(c.createdAt), "dd MMM yyyy")}
                            </span>
                          </div>
                          <div className="space-y-1 text-sm">
                            <p className="font-medium">{c.issueType}</p>
                            <p className="whitespace-pre-wrap text-muted-foreground">{c.description}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Logged by {c.loggedBy}
                            {c.resolvedAt ? ` · Resolved ${format(new Date(c.resolvedAt), "dd MMM yyyy")}` : ""}
                          </p>
                          {c.resolutionNote && (
                            <p className="rounded-md bg-success/10 px-3 py-2 text-xs text-success">
                              {c.resolutionNote}
                            </p>
                          )}
                          {c.notes.length > 0 && (
                            <div className="space-y-1.5 border-t border-border pt-2">
                              <p className="text-xs font-medium text-foreground">Activity</p>
                              {c.notes.map((n, j) => (
                                <p key={j} className="text-xs text-muted-foreground">
                                  <span className="text-foreground">{n.by}</span> · {format(new Date(n.at), "dd MMM, HH:mm")} — {n.text}
                                </p>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
}
