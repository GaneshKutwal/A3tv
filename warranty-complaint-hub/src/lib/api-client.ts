/**API Client for frontend → backend integration */
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Create axios instance
const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — token expired → redirect to login
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default apiClient;

// ─── Auth ────────────────────────────────────────────────────────────────────

export const login = (username: string, password: string) =>
  apiClient.post('/auth/login', { username, password });

export const logout = () => apiClient.post('/auth/logout');

// ─── Warranties ───────────────────────────────────────────────────────────────

/** Create a new warranty — must be FormData (multipart) */
export const createWarranty = (formData: FormData) =>
  apiClient.post('/warranties', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

/** List warranties with optional query filters */
export const getWarranties = (filters?: Record<string, any>) =>
  apiClient.get('/warranties', { params: filters });

/** Get a single warranty by serial number */
export const getWarranty = (serialNo: string) =>
  apiClient.get(`/warranties/${serialNo}`);

// ─── Complaints ───────────────────────────────────────────────────────────────

/** Create a new complaint — must be FormData (multipart) */
export const createComplaint = (formData: FormData) =>
  apiClient.post('/complaints', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

/** List complaints with optional query filters */
export const getComplaints = (filters?: Record<string, any>) =>
  apiClient.get('/complaints', { params: filters });

/** Get a single complaint by ID */
export const getComplaint = (complaintId: string) =>
  apiClient.get(`/complaints/${complaintId}`);

/** Update complaint description/priority — must be FormData (multipart) */
export const updateComplaint = (complaintId: string, formData: FormData) =>
  apiClient.put(`/complaints/${complaintId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

/** Resolve a complaint — must be FormData (multipart) with status_update & resolutionNotes */
export const resolveComplaint = (complaintId: string, formData: FormData) =>
  apiClient.put(`/complaints/${complaintId}/resolve`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// ─── Analytics ────────────────────────────────────────────────────────────────

export const getDashboardStats = () => apiClient.get('/dashboard/stats');
