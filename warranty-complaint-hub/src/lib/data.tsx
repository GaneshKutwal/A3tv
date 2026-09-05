"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import apiClient, {
  login as apiLogin,
  logout as apiLogout,
  createWarranty,
  getWarranties,
  createComplaint,
  getComplaints,
  updateComplaint as apiUpdateComplaint,
  resolveComplaint as apiResolveComplaint,
} from "./api-client";
import { toast } from "sonner";

// ─── Warranty Types ──────────────────────────────────────────────────────────

export interface Warranty {
  id: string;
  serialNo: string;
  model: string;
  customerName: string;
  phone: string;
  email: string;
  address: string;
  purchaseDate: string; // ISO date
  durationMonths: number;
  dealerName: string;
  dealerLocation: string;
  invoiceDataUrl?: string;
  invoicePaths?: string[];
}

// ─── Complaint Types ─────────────────────────────────────────────────────────

export type ComplaintStatus = "Open" | "In Progress" | "Resolved";
export type ComplaintPriority = "Low" | "Medium" | "High";

export interface ComplaintNote {
  text: string;
  at: string;
  by: string;
}

export interface Complaint {
  id: string;
  serialNo: string;
  issueType: string;
  priority: ComplaintPriority;
  description: string;
  status: ComplaintStatus;
  loggedBy: string;
  assignedTo: string | null;
  createdAt: string;
  resolvedAt?: string;
  resolutionNote?: string;
  notes: ComplaintNote[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const ENGINEERS = [
  "Ravi Sharma",
  "Amit Patel",
  "Sneha Kulkarni",
  "Vikram Rao",
];

export const ISSUE_TYPES = [
  "No Power",
  "Display Issue",
  "Sound Problem",
  "Panel Damage",
  "Remote Not Working",
  "Software / Smart TV",
  "Installation",
  "Other",
];

// ─── Warranty helpers ────────────────────────────────────────────────────────

export function warrantyEndDate(w: Warranty): Date {
  const d = new Date(w.purchaseDate);
  d.setMonth(d.getMonth() + w.durationMonths);
  return d;
}

export function warrantyIsActive(w: Warranty): boolean {
  return warrantyEndDate(w).getTime() >= Date.now();
}

function compareComplaintIdsDescending(a: Complaint, b: Complaint): number {
  const aNumber = Number(a.id.match(/^CMP-(\d+)$/i)?.[1] ?? -1);
  const bNumber = Number(b.id.match(/^CMP-(\d+)$/i)?.[1] ?? -1);
  if (aNumber !== bNumber) return bNumber - aNumber;
  return b.createdAt.localeCompare(a.createdAt);
}

function compareWarrantySerialNumbers(a: Warranty, b: Warranty): number {
  return b.serialNo.localeCompare(a.serialNo, undefined, { numeric: true, sensitivity: "base" });
}

// ─── Field-name mappers (backend → frontend) ─────────────────────────────────

function mapWarranty(raw: any): Warranty {
  return {
    id: raw.warrantyId ?? raw.id ?? "",
    serialNo: raw.serialNumber ?? raw.serialNo ?? "",
    model: raw.productName ?? raw.model ?? "A3 Television",
    customerName: raw.customerName ?? "",
    phone: raw.phone ?? "",
    email: raw.email ?? "",
    address: raw.address ?? "",
    purchaseDate: raw.purchaseDate ?? "",
    durationMonths:
      raw.warrantyMonths ??
      raw.durationMonths ??
      // derive from warrantyEndDate if available
      (raw.warrantyEndDate && raw.purchaseDate
        ? Math.round(
            (new Date(raw.warrantyEndDate).getTime() -
              new Date(raw.purchaseDate).getTime()) /
              (30 * 24 * 3600 * 1000)
          )
        : 24),
    dealerName: raw.dealerName ?? "",
    dealerLocation: raw.dealerLocation ?? "",
    invoiceDataUrl: raw.invoiceDataUrl,
    invoicePaths: raw.invoicePaths ?? (raw.invoicePath ? [raw.invoicePath] : []),
  };
}

function mapComplaint(raw: any): Complaint {
  const userIdentity = (value: string | undefined): string => {
    if (value === "user-001") return "employee1@a3tv.com";
    if (value === "user-002") return "employee2@a3tv.com";
    return value ?? "Service Desk";
  };

  // backend stores priority as "LOW"/"MEDIUM"/"HIGH" — normalise to title-case
  const normalisePriority = (p: string): ComplaintPriority => {
    if (!p) return "Medium";
    const lc = p.toLowerCase();
    if (lc === "low") return "Low";
    if (lc === "high") return "High";
    return "Medium";
  };

  // backend stores status as "OPEN" / "IN_PROGRESS" / "RESOLVED"
  const normaliseStatus = (s: string): ComplaintStatus => {
    if (!s) return "Open";
    const lc = s.toLowerCase();
    if (lc === "resolved") return "Resolved";
    if (lc === "in_progress" || lc === "in progress") return "In Progress";
    return "Open";
  };

  const rawDescription = raw.description ?? "";
  const descriptionLines = rawDescription.split("\n");

  return {
    id: raw.complaintId ?? raw.id ?? "",
    serialNo: raw.serialNumber ?? raw.serialNo ?? "",
    issueType: raw.issueType ?? descriptionLines[0] ?? "Other",
    priority: normalisePriority(raw.priority),
    description: raw.issueType ? rawDescription : descriptionLines.slice(1).join("\n").trim() || rawDescription,
    status: normaliseStatus(raw.status),
    loggedBy: userIdentity(raw.loggedBy ?? raw.LoggedBy ?? raw.userId),
    assignedTo: raw.assignedTo ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    resolvedAt: raw.resolvedAt,
    resolutionNote: raw.resolutionNotes ?? raw.resolutionNote,
    notes: Array.isArray(raw.notes)
      ? raw.notes.map((note: ComplaintNote) => ({ ...note, by: userIdentity(note.by) }))
      : [],
  };
}

// ─── Auth Context ────────────────────────────────────────────────────────────

interface AuthState {
  user: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    const savedUser = localStorage.getItem("currentUser");
    if (token && savedUser) {
      setUser(savedUser);
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      setLoading(true);
      const response = await apiLogin(username, password);
      const loginData = response.data?.data ?? response.data;
      const { access_token, accessToken } = loginData;
      const token = access_token ?? accessToken;
      const identity = loginData.user?.email ?? username;
      const displayName = loginData.user?.name ?? identity;
      localStorage.setItem("authToken", token);
      localStorage.setItem("currentUser", identity);
      setUser(identity);
      toast.success(`Welcome, ${displayName}`);
    } catch (error: any) {
      const message = error.response?.data?.error ?? error.response?.data?.detail ?? "Invalid credentials";
      toast.error(message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await apiLogout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("authToken");
      localStorage.removeItem("currentUser");
      setUser(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

// ─── Data Context (warranties + complaints via real API) ─────────────────────

interface DataState {
  warranties: Warranty[];
  complaints: Complaint[];
  loadingWarranties: boolean;
  loadingComplaints: boolean;
  fetchWarranties: (filters?: any) => Promise<void>;
  fetchComplaints: (filters?: any) => Promise<void>;
  addWarranty: (formData: FormData) => Promise<Warranty>;
  addComplaint: (formData: FormData) => Promise<Complaint>;
  updateComplaint: (
    complaintId: string,
    fields: {
      status?: ComplaintStatus;
      priority?: ComplaintPriority;
      assignedTo?: string | null;
      description?: string;
    },
    note: string,
    by: string
  ) => Promise<void>;
  resolveComplaint: (
    complaintId: string,
    resolutionNote: string,
    by: string
  ) => Promise<void>;
}

const DataContext = createContext<DataState | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loadingWarranties, setLoadingWarranties] = useState(false);
  const [loadingComplaints, setLoadingComplaints] = useState(false);

  // ── Warranties ──

  const fetchWarranties = useCallback(async (filters?: any) => {
    try {
      setLoadingWarranties(true);
      const response = await getWarranties(filters);
      // backend returns { data: { warranties: [...] } } or { data: [...] }
      const raw = response.data?.data;
      const list: any[] = Array.isArray(raw) ? raw : (raw?.warranties ?? []);
      setWarranties(list.map(mapWarranty).sort(compareWarrantySerialNumbers));
    } catch (err: any) {
      const message = err.response?.data?.error ?? err.response?.data?.detail ?? "Failed to fetch warranties";
      toast.error(message);
    } finally {
      setLoadingWarranties(false);
    }
  }, []);

  const addWarranty = useCallback(async (formData: FormData): Promise<Warranty> => {
    try {
      const response = await createWarranty(formData);
      const raw = response.data?.data ?? response.data;
      const warranty = mapWarranty(raw);
      setWarranties((prev) => [...prev, warranty].sort(compareWarrantySerialNumbers));
      toast.success("Warranty registered successfully");
      return warranty;
    } catch (err: any) {
      const message = err.response?.data?.error ?? err.response?.data?.detail ?? "Failed to create warranty";
      toast.error(message);
      throw err;
    }
  }, []);

  // ── Complaints ──

  const fetchComplaints = useCallback(async (filters?: any) => {
    try {
      setLoadingComplaints(true);
      const response = await getComplaints(filters);
      const raw = response.data?.data;
      const list: any[] = Array.isArray(raw) ? raw : (raw?.complaints ?? []);
      setComplaints(list.map(mapComplaint).sort(compareComplaintIdsDescending));
    } catch (err: any) {
      const message = err.response?.data?.error ?? err.response?.data?.detail ?? "Failed to fetch complaints";
      toast.error(message);
    } finally {
      setLoadingComplaints(false);
    }
  }, []);

  const addComplaint = useCallback(async (formData: FormData): Promise<Complaint> => {
    try {
      const response = await createComplaint(formData);
      const raw = response.data?.data ?? response.data;
      const complaint = mapComplaint(raw);
      setComplaints((prev) => [...prev, complaint].sort(compareComplaintIdsDescending));
      toast.success("Complaint registered successfully");
      return complaint;
    } catch (err: any) {
      const message = err.response?.data?.error ?? err.response?.data?.detail ?? "Failed to register complaint";
      toast.error(message);
      throw err;
    }
  }, []);

  const updateComplaint = useCallback(
    async (
      complaintId: string,
      fields: {
        status?: ComplaintStatus;
        priority?: ComplaintPriority;
        assignedTo?: string | null;
        description?: string;
      },
      note: string,
      by: string
    ) => {
      try {
        const formData = new FormData();
        if (fields.status) {
          formData.append("status", fields.status.toUpperCase().replace(/\s+/g, "_"));
        }
        if (fields.priority) formData.append("priority", fields.priority.toUpperCase());
        if (fields.assignedTo !== undefined) {
          formData.append("assignedTo", fields.assignedTo ?? "");
        }
        if (fields.description) formData.append("description", fields.description);
        if (note.trim()) {
          formData.append("note", note.trim());
          formData.append("noteBy", by);
        }

        const response = await apiUpdateComplaint(complaintId, formData);
        const raw = response.data?.data ?? response.data;

        setComplaints((prev) =>
          prev.map((c) => {
            if (c.id !== complaintId) return c;
            const mapped = mapComplaint(raw);
            const updated: Complaint = {
              ...c,
              ...mapped,
              status: fields.status ?? c.status,
              assignedTo: fields.assignedTo !== undefined ? fields.assignedTo : c.assignedTo,
            };
            if (note.trim() && mapped.notes.length === c.notes.length) {
              updated.notes = [
                ...c.notes,
                { text: note.trim(), at: new Date().toISOString(), by },
              ];
            }
            return updated;
          })
        );
        toast.success("Complaint updated");
      } catch (err: any) {
        const message = err.response?.data?.error ?? err.response?.data?.detail ?? "Failed to update complaint";
        toast.error(message);
        throw err;
      }
    },
    []
  );

  const resolveComplaint = useCallback(
    async (complaintId: string, resolutionNote: string, by: string) => {
      try {
        const formData = new FormData();
        formData.append("status_update", "RESOLVED");
        formData.append("resolutionNotes", resolutionNote);
        formData.append("noteBy", by);

        const response = await apiResolveComplaint(complaintId, formData);
        const raw = response.data?.data ?? response.data;

        setComplaints((prev) =>
          prev.map((c) => {
            if (c.id !== complaintId) return c;
            return {
              ...c,
              status: "Resolved" as ComplaintStatus,
              resolvedAt: raw.updatedAt ?? new Date().toISOString(),
              resolutionNote,
              notes: Array.isArray(raw.notes)
                ? raw.notes
                : [
                    ...c.notes,
                    { text: resolutionNote, at: new Date().toISOString(), by },
                  ],
            };
          })
        );
        toast.success("Complaint resolved");
      } catch (err: any) {
        const message = err.response?.data?.error ?? err.response?.data?.detail ?? "Failed to resolve complaint";
        toast.error(message);
        throw err;
      }
    },
    []
  );

  return (
    <DataContext.Provider
      value={{
        warranties,
        complaints,
        loadingWarranties,
        loadingComplaints,
        fetchWarranties,
        fetchComplaints,
        addWarranty,
        addComplaint,
        updateComplaint,
        resolveComplaint,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}

// ─── Backwards-compat hooks (used by dashboard) ───────────────────────────────

export function useWarranties() {
  const { warranties, loadingWarranties: loading, fetchWarranties, addWarranty } = useData();
  return { warranties, loading, fetchWarranties, addWarranty };
}

export function useComplaints() {
  const {
    complaints,
    loadingComplaints: loading,
    fetchComplaints,
    addComplaint,
    updateComplaint,
    resolveComplaint,
  } = useData();
  return { complaints, loading, fetchComplaints, addComplaint, updateComplaint, resolveComplaint };
}
