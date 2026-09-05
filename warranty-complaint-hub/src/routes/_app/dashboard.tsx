import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, animate } from "motion/react";
import {
  ShieldCheck,
  ShieldPlus,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWarranties, useComplaints, warrantyIsActive } from "@/lib/data";
import { StatusBadge } from "@/components/status-badge";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — A3 Television Service Desk" },
      { name: "description", content: "Overview of warranties and complaints at A3 Television service desk." },
      { property: "og:title", content: "Dashboard — A3 Television Service Desk" },
      { property: "og:description", content: "Overview of warranties and complaints at A3 Television service desk." },
    ],
  }),
  component: DashboardPage,
});

function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const controls = animate(0, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value]);
  return <span ref={ref}>{display}</span>;
}

function DashboardPage() {
  const { warranties, fetchWarranties } = useWarranties();
  const { complaints, fetchComplaints } = useComplaints();

  useEffect(() => {
    fetchWarranties();
    fetchComplaints();
  }, []);

  const active = warranties.filter(warrantyIsActive).length;
  const open = complaints.filter((c) => c.status === "Open").length;
  const resolved = complaints.filter((c) => c.status === "Resolved").length;
  const expiringSoon = warranties.filter((w) => {
    if (!warrantyIsActive(w)) return false;
    const end = new Date(w.purchaseDate);
    end.setMonth(end.getMonth() + w.durationMonths);
    return end.getTime() - Date.now() < 45 * 24 * 3600 * 1000;
  });

  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const label = d.toLocaleString("en", { month: "short" });
    const count = complaints.filter((c) => {
      const cd = new Date(c.createdAt);
      return `${cd.getFullYear()}-${cd.getMonth()}` === key;
    }).length;
    return { month: label, complaints: count };
  });

  const recent = complaints.slice(0, 7);

  const kpis = [
    { label: "Total Warranties", value: warranties.length, icon: ShieldCheck, to: "/warranty" },
    { label: "Active Warranties", value: active, icon: ShieldPlus, to: "/warranty" },
    { label: "Open Complaints", value: open, icon: ClipboardList, to: "/complaints" },
    { label: "Resolved", value: resolved, icon: CheckCircle2, to: "/complaints" },
  ];

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4 lg:p-6">
      <div className="grid shrink-0 grid-cols-2 gap-4 xl:grid-cols-4">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.35 }}
          >
            <Link to={kpi.to}>
              <Card className="transition-colors hover:border-primary/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">
                    {kpi.label}
                  </CardTitle>
                  <kpi.icon className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="font-display text-3xl font-bold">
                    <CountUp value={kpi.value} />
                  </p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-5">
        <Card className="flex min-h-0 flex-col lg:col-span-3">
          <CardHeader className="shrink-0">
            <CardTitle className="text-sm">Complaints — last 6 months</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  cursor={{ fill: "color-mix(in oklab, var(--primary) 8%, transparent)" }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    color: "var(--popover-foreground)",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="complaints" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-col lg:col-span-2">
          <CardHeader className="shrink-0">
            <CardTitle className="text-sm">Recent complaints</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 p-0">
            <ScrollArea className="h-full px-6 pb-4 pr-9">
              <div className="w-full min-w-0 space-y-3">
                {recent.map((c) => (
                  <div key={c.id} className="flex w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-lg border border-border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.id} · {c.serialNo}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.issueType}</p>
                    </div>
                    <div className="shrink-0">
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {expiringSoon.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex shrink-0 items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          <p className="truncate text-sm">
            <span className="font-medium">{expiringSoon.length} warrant{expiringSoon.length === 1 ? "y" : "ies"}</span>{" "}
            expire within 45 days:{" "}
            <span className="text-muted-foreground">
              {expiringSoon.map((w) => w.serialNo).join(", ")}
            </span>
          </p>
          <Link to="/warranty" className="ml-auto shrink-0">
            <Badge variant="outline" className="gap-1 border-warning/50 text-warning">
              Review <ArrowRight className="h-3 w-3" />
            </Badge>
          </Link>
        </motion.div>
      )}
    </div>
  );
}
