import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";
import { Search, CalendarIcon, FileSpreadsheet, Pencil, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { downloadCsv } from "@/lib/csv-export";

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
  const { warranties, loadingWarranties, fetchWarranties, updateWarranty } = useData();
  const [serialQuery, setSerialQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [range, setRange] = useState<DateRange | undefined>();
  const [selected, setSelected] = useState<Warranty | null>(null);

  // Edit warranty state
  const [editingWarranty, setEditingWarranty] = useState<Warranty | null>(null);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editPurchaseDate, setEditPurchaseDate] = useState("");
  const [editDuration, setEditDuration] = useState("24");
  const [editDealerName, setEditDealerName] = useState("");
  const [editDealerLocation, setEditDealerLocation] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    fetchWarranties();
  }, []);

  const openEditWarranty = (w: Warranty, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingWarranty(w);
    setEditCustomerName(w.customerName);
    setEditPhone(w.phone);
    setEditEmail(w.email);
    setEditAddress(w.address);
    setEditModel(w.model);
    setEditPurchaseDate(w.purchaseDate ? w.purchaseDate.slice(0, 10) : "");
    setEditDuration(String(w.durationMonths || 24));
    setEditDealerName(w.dealerName);
    setEditDealerLocation(w.dealerLocation);
  };

  const saveWarrantyEdit = async () => {
    if (!editingWarranty) return;
    if (!editCustomerName.trim() || !editPhone.trim()) {
      toast.error("Customer name and phone number are required");
      return;
    }
    const formData = new FormData();
    formData.append("customerName", editCustomerName.trim());
    formData.append("phone", editPhone.trim());
    formData.append("email", editEmail.trim());
    formData.append("address", editAddress.trim());
    formData.append("productName", editModel.trim() || "A3 Television");
    if (editPurchaseDate) {
      formData.append("purchaseDate", editPurchaseDate);
    }
    formData.append("warrantyMonths", editDuration);
    formData.append("dealerName", editDealerName.trim());
    formData.append("dealerLocation", editDealerLocation.trim());

    try {
      setEditSaving(true);
      const updated = await updateWarranty(editingWarranty.serialNo, formData);
      if (selected && selected.serialNo === editingWarranty.serialNo) {
        setSelected(updated);
      }
      setEditingWarranty(null);
    } catch {
      // toast handled in updateWarranty
    } finally {
      setEditSaving(false);
    }
  };

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

  const exportWarranties = () => {
    downloadCsv(
      `warranties-${format(new Date(), "yyyy-MM-dd")}.csv`,
      ["Serial No", "Model", "Customer", "Phone", "Email", "Purchase Date", "Warranty Ends", "Dealer", "Dealer Location", "Status"],
      filtered.map((w) => [
        w.serialNo,
        w.model,
        w.customerName,
        w.phone,
        w.email,
        format(new Date(w.purchaseDate), "yyyy-MM-dd"),
        format(warrantyEndDate(w), "yyyy-MM-dd"),
        w.dealerName,
        w.dealerLocation,
        warrantyIsActive(w) ? "Active" : "Expired",
      ]),
    );
  };

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
        <Button variant="outline" size="sm" className="gap-2" onClick={exportWarranties} disabled={!filtered.length}>
          <FileSpreadsheet className="h-4 w-4" /> Export CSV
        </Button>
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
                <TableHead className="text-right">Actions</TableHead>
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
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1"
                        onClick={(e) => openEditWarranty(w, e)}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Update
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
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
              <SheetHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <SheetTitle className="font-display">{selected.serialNo}</SheetTitle>
                  <SheetDescription>{selected.model}</SheetDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => openEditWarranty(selected)}
                >
                  <Pencil className="h-3.5 w-3.5" /> Update
                </Button>
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

      {/* Update Warranty Dialog */}
      <Dialog open={!!editingWarranty} onOpenChange={(o) => !o && setEditingWarranty(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Update Warranty — {editingWarranty?.serialNo}</DialogTitle>
            <DialogDescription>
              Modify customer, product, or dealer details for this warranty.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-customer-name">Full Name *</Label>
              <Input
                id="edit-customer-name"
                value={editCustomerName}
                onChange={(e) => setEditCustomerName(e.target.value)}
                placeholder="e.g. Rahul Mehta"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone Number *</Label>
              <Input
                id="edit-phone"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="e.g. 98220 11445"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="customer@mail.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-model">Model</Label>
              <Input
                id="edit-model"
                value={editModel}
                onChange={(e) => setEditModel(e.target.value)}
                placeholder='A3 NeoView 43"'
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-address">Address</Label>
              <Textarea
                id="edit-address"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder="Street, city"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-purchase-date">Purchase Date</Label>
              <Input
                id="edit-purchase-date"
                type="date"
                value={editPurchaseDate}
                onChange={(e) => setEditPurchaseDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Warranty Duration</Label>
              <Select value={editDuration} onValueChange={setEditDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[12, 24, 36, 48].map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} months
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-dealer-name">Dealer Name</Label>
              <Input
                id="edit-dealer-name"
                value={editDealerName}
                onChange={(e) => setEditDealerName(e.target.value)}
                placeholder="e.g. Shree Electronics"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-dealer-location">Dealer Location</Label>
              <Input
                id="edit-dealer-location"
                value={editDealerLocation}
                onChange={(e) => setEditDealerLocation(e.target.value)}
                placeholder="e.g. Pune"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingWarranty(null)} disabled={editSaving}>
              Cancel
            </Button>
            <Button onClick={saveWarrantyEdit} disabled={editSaving}>
              {editSaving ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
