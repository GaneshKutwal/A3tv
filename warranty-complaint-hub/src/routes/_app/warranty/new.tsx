import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, ImagePlus, X } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useData } from "@/lib/data";

export const Route = createFileRoute("/_app/warranty/new")({
  head: () => ({
    meta: [
      { title: "New Warranty — A3 Television Service Desk" },
      { name: "description", content: "Register a new A3 Television warranty with customer, product, and dealer details." },
      { property: "og:title", content: "New Warranty — A3 Television Service Desk" },
      { property: "og:description", content: "Register a new A3 Television warranty with customer, product, and dealer details." },
    ],
  }),
  component: NewWarrantyPage,
});

const DURATIONS = [12, 24, 36, 48];

function NewWarrantyPage() {
  const { addWarranty } = useData();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [model, setModel] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState<Date | undefined>();
  const [durationMonths, setDurationMonths] = useState<string>("24");
  const [dealerName, setDealerName] = useState("");
  const [dealerLocation, setDealerLocation] = useState("");
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);

  const handleInvoice = (files: FileList | null) => {
    if (!files) return;
    setInvoiceFiles(Array.from(files));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !phone.trim() || !serialNo.trim() || !purchaseDate || !dealerName.trim()) {
      toast.error("Fill in all required fields (*)");
      return;
    }
    if (invoiceFiles.length === 0) {
      toast.error("Please upload an invoice / purchase receipt");
      return;
    }

    // Build FormData matching backend field names exactly
    const formData = new FormData();
    formData.append("serialNumber", serialNo.trim());
    formData.append("productName", model.trim() || "A3 Television");
    formData.append("productCategory", "Television");
    formData.append("purchaseDate", purchaseDate!.toISOString().slice(0, 10)); // YYYY-MM-DD
    formData.append("warrantyMonths", durationMonths);
    invoiceFiles.forEach((file) => formData.append("invoice", file));

    // Extra customer/dealer fields — attach as additional form data so the
    // backend can store them; the backend may ignore unknown fields gracefully.
    formData.append("customerName", customerName.trim());
    formData.append("phone", phone.trim());
    if (email.trim()) formData.append("email", email.trim());
    if (address.trim()) formData.append("address", address.trim());
    formData.append("dealerName", dealerName.trim());
    if (dealerLocation.trim()) formData.append("dealerLocation", dealerLocation.trim());

    try {
      setSubmitting(true);
      await addWarranty(formData);
      navigate({ to: "/warranty" });
    } catch {
      // Error already toasted inside addWarranty
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollArea className="h-full">
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mx-auto grid max-w-5xl gap-4 p-4 lg:grid-cols-2 lg:p-6"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Full name *</Label>
              <Input id="customerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g. Rahul Mehta" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number *</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 98220 11445" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@mail.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city" rows={3} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Product &amp; Warranty</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="serialNo">Serial number *</Label>
                  <Input id="serialNo" value={serialNo} onChange={(e) => setSerialNo(e.target.value)} placeholder="A3T-00000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} placeholder='A3 NeoView 43"' />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Purchase date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start gap-2 font-normal">
                        <CalendarIcon className="h-4 w-4" />
                        {purchaseDate ? format(purchaseDate, "dd MMM yyyy") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={purchaseDate} onSelect={setPurchaseDate} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Warranty duration</Label>
                  <Select value={durationMonths} onValueChange={setDurationMonths}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATIONS.map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {m} months
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Invoice / purchase receipt *</Label>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => handleInvoice(e.target.files)}
                />
                {invoiceFiles.length > 0 ? (
                  <div className="space-y-2 rounded-lg border border-border px-3 py-2 text-sm">
                    {invoiceFiles.map((file) => (
                      <div key={`${file.name}-${file.size}`} className="flex items-center gap-2">
                        <span className="truncate">{file.name}</span>
                      </div>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="gap-1"
                      onClick={() => setInvoiceFiles([])}
                    >
                      <X className="h-3 w-3" /> Clear files
                    </Button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
                    <ImagePlus className="h-4 w-4" /> Upload photo / PDF
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Dealer</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dealerName">Dealer name *</Label>
                <Input id="dealerName" value={dealerName} onChange={(e) => setDealerName(e.target.value)} placeholder="e.g. Shree Electronics" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dealerLocation">Dealer location</Label>
                <Input id="dealerLocation" value={dealerLocation} onChange={(e) => setDealerLocation(e.target.value)} placeholder="e.g. Pune" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-3 lg:col-span-2">
          <Button type="button" variant="ghost" onClick={() => navigate({ to: "/warranty" })}>
            Cancel
          </Button>
          <Button type="submit" className="glow-primary" disabled={submitting}>
            {submitting ? "Registering…" : "Register Warranty"}
          </Button>
        </div>
      </motion.form>
    </ScrollArea>
  );
}
