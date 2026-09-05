import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";
import { Search, CalendarIcon, X } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useData, warrantyEndDate, warrantyIsActive, type Warranty } from "@/lib/data";

export const Route = createFileRoute("/_app/warranty/")({
  head: () => ({
    meta: [
      { title: "Warranties — A3 Television Service Desk" },
      { name: "description", content: "Browse and filter A3 Television warranties by serial number, product, and purchase date." },
      { property: "og:title", content: "Warranties — A3 Television Service Desk" },
      { property: "og:description", content: "Browse and filter A3 Television warranties by serial number, product, and purchase date." },
    ],
  }),
  component: WarrantyListPage,
});

function WarrantyListPage() {
  const { warranties, loadingWarranties, fetchWarranties } = useData();
  const [serialQuery, setSerialQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [range, setRange] = useState<DateRange | undefined>();
  const [selected, setSelected] = useState<Warranty | null>(null);

  useEffect(() => {
    fetchWarranties();
  }, []);

  const filtered = useMemo(() => {
    return warranties.filter((w) => {
      if (serialQuery && !w.serialNo.toLowerCase().includes(serialQuery.toLowerCase()))
        return false;
      if (
        productQuery &&
        !`${w.model} ${w.customerName}`.toLowerCase().includes(productQuery.toLowerCase())
      )
        return false;
      if (range?.from) {
        const pd = new Date(w.purchaseDate);
        if (pd < range.from) return false;
        if (range.to) {
          const end = new Date(range.to);
          end.setHours(23, 59, 59);
          if (pd > end) return false;
        }
      }
      return true;
    });
  }, [warranties, serialQuery, productQuery, range]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4 lg:p-6">
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={serialQuery}
            onChange={(e) => setSerialQuery(e.target.value)}
            placeholder="Filter by serial number"
            className="w-56 pl-9"
          />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            placeholder="Product / customer name"
            className="w-56 pl-9"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-64 justify-start gap-2 font-normal">
              <CalendarIcon className="h-4 w-4" />
              {range?.from
                ? range.to
                  ? `${format(range.from, "dd MMM yy")} – ${format(range.to, "dd MMM yy")}`
                  : format(range.from, "dd MMM yyyy")
                : "Purchase date range"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={2} />
          </PopoverContent>
        </Popover>
        {(serialQuery || productQuery || range?.from) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSerialQuery("");
              setProductQuery("");
              setRange(undefined);
            }}
            className="gap-1"
          >
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
        <p className="ml-auto text-sm text-muted-foreground">
          {filtered.length} of {warranties.length} warranties
        </p>
      </div>

      <div className="min-h-0 flex-1 rounded-lg border border-border">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>Serial No</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Purchase Date</TableHead>
                <TableHead>Warranty Ends</TableHead>
                <TableHead>Dealer</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((w) => {
                const isActive = warrantyIsActive(w);
                return (
                  <TableRow
                    key={w.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(w)}
                  >
                    <TableCell className="font-medium">{w.serialNo}</TableCell>
                    <TableCell>{w.model}</TableCell>
                    <TableCell>{w.customerName}</TableCell>
                    <TableCell className="text-muted-foreground">{w.phone}</TableCell>
                    <TableCell>{format(new Date(w.purchaseDate), "dd MMM yyyy")}</TableCell>
                    <TableCell>{format(warrantyEndDate(w), "dd MMM yyyy")}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {w.dealerName}, {w.dealerLocation}
                    </TableCell>
                    <TableCell>
                      {isActive ? (
                        <Badge variant="outline" className="border-success/40 bg-success/15 text-success">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-destructive/40 bg-destructive/15 text-destructive">
                          Expired
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No warranties match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display">{selected.serialNo}</SheetTitle>
                <SheetDescription>{selected.model}</SheetDescription>
              </SheetHeader>
              <div className="space-y-5 px-4 pb-6">
                <Badge
                  variant="outline"
                  className={
                    warrantyIsActive(selected)
                      ? "border-success/40 bg-success/15 text-success"
                      : "border-destructive/40 bg-destructive/15 text-destructive"
                  }
                >
                  {warrantyIsActive(selected) ? "Warranty Active" : "Warranty Expired"}
                </Badge>
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Customer
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">{selected.customerName}</p>
                    <p className="text-muted-foreground">{selected.phone}</p>
                    {selected.email && <p className="text-muted-foreground">{selected.email}</p>}
                    {selected.address && <p className="text-muted-foreground">{selected.address}</p>}
                  </div>
                </section>
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Warranty
                  </h3>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Purchased {format(new Date(selected.purchaseDate), "dd MMM yyyy")}</p>
                    <p>
                      {selected.durationMonths} months — ends{" "}
                      {format(warrantyEndDate(selected), "dd MMM yyyy")}
                    </p>
                  </div>
                </section>
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Dealer
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selected.dealerName}, {selected.dealerLocation}
                  </p>
                </section>
                {selected.invoiceDataUrl && (
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Invoice
                    </h3>
                    <img
                      src={selected.invoiceDataUrl}
                      alt="Invoice"
                      className="max-h-48 rounded-lg border border-border object-contain"
                    />
                  </section>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
