/**API Client for frontend → backend integration */
import axios from 'axios';

const API_BASE_URL = import.meta.env['VITE_API_BASE_URL'] || 'http://localhost:8000';
const AUTH_MODE = import.meta.env['VITE_AUTH_MODE'] || 'local';
const COGNITO_REGION = import.meta.env['VITE_COGNITO_REGION'] || 'ap-south-1';
const COGNITO_CLIENT_ID = import.meta.env['VITE_COGNITO_CLIENT_ID'];

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

export const login = async (username: string, password: string) => {
  if (AUTH_MODE === 'local') {
    return apiClient.post('/auth/login', { username, password });
  }

  if (!COGNITO_CLIENT_ID) {
    throw new Error('Cognito client ID is not configured');
  }

  const response = await axios.post<{
    AuthenticationResult?: {
      AccessToken: string;
      IdToken: string;
      RefreshToken?: string;
      ExpiresIn: number;
    };
    ChallengeName?: string;
  }>(
    `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`,
    {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    },
    {
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
    },
  );

  if (!response.data.AuthenticationResult) {
    throw new Error(
      response.data.ChallengeName === 'NEW_PASSWORD_REQUIRED'
        ? 'A permanent password must be set for this user before signing in'
        : 'Cognito authentication challenge is not supported',
    );
  }

  const result = response.data.AuthenticationResult;
  const idTokenClaims = JSON.parse(atob(result.IdToken.split('.')[1]));
  return {
    data: {
      accessToken: result.IdToken,
      cognitoAccessToken: result.AccessToken,
      idToken: result.IdToken,
      refreshToken: result.RefreshToken,
      expiresIn: result.ExpiresIn,
      user: {
        email: idTokenClaims.email ?? username,
        name: idTokenClaims.name ?? idTokenClaims.email ?? username,
      },
    },
  };
};

export const logout = async () => undefined;

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
