import axios from 'axios';
import { QueryClient } from 'react-query';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // include httpOnly refresh cookie
  timeout: 30000, // 30 second timeout
});

// Retry configuration
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 second

// Retry logic for failed requests
const retryRequest = async (config, retryCount = 0) => {
  try {
    return await api(config);
  } catch (error) {
    if (retryCount < MAX_RETRIES && (!error.response || error.response.status >= 500)) {
      // Retry on network errors or 5xx errors
      const delay = RETRY_DELAY * Math.pow(2, retryCount); // Exponential backoff
      console.log(`Retrying request (${retryCount + 1}/${MAX_RETRIES}) after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryRequest(config, retryCount + 1);
    }
    throw error;
  }
};

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle network errors
    if (!error.response) {
      console.error('Network Error:', error);
      return Promise.reject(new Error('Network error - please check your connection'));
    }

    // Handle 401 and token refresh
    if (error.response.status === 401 && !originalRequest._retry && originalRequest.url !== '/auth/refresh-tokens') {
      if (isRefreshing) {
        // If already refreshing, wait for it to finish
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = 'Bearer ' + token;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResp = await authAPI.refreshToken();
        const newAccess = refreshResp.data?.tokens?.access?.token || refreshResp.data?.tokens?.access;
        if (newAccess) {
          localStorage.setItem('token', newAccess);
          api.defaults.headers.Authorization = `Bearer ${newAccess}`;
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
          processQueue(null, newAccess);
          return api(originalRequest);
        }
      } catch (refreshErr) {
        console.error('Token refresh failed:', refreshErr);
        processQueue(refreshErr, null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(new Error('Session expired - please log in again'));
      } finally {
        isRefreshing = false;
      }
    }

    // Handle specific error cases
    const errorMessage = error.response?.data?.message || error.response?.data?.error || 'An error occurred';

    switch (error.response.status) {
      case 400:
        console.error('Bad Request:', errorMessage);
        break;
      case 403:
        console.error('Forbidden:', errorMessage);
        break;
      case 404:
        console.error('Not Found:', errorMessage);
        break;
      case 429:
        console.error('Too Many Requests:', errorMessage);
        break;
      case 500:
        console.error('Server Error:', errorMessage);
        break;
      default:
        console.error('API Error:', errorMessage);
    }

    return Promise.reject(new Error(errorMessage));
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getCurrentUser: () => api.get('/auth/me'),
  refreshToken: () => api.post('/auth/refresh-tokens'),
};

export const requestPasswordReset = async (email) => {
  return await api.post('/auth/forgot-password', { email });
};

export const resetPassword = async (token, password) => {
  return await api.post('/auth/reset-password', { token, password });
};

export const requestEmailVerification = async () => {
  return await api.post('/auth/send-verification-email');
};

export const verifyEmail = async (token) => {
  return await api.post('/auth/verify-email', { token });
};

// Import API
export const importAPI = {
  upload: (file, onUploadProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    });
  },
  uploadWhatsApp: (file, onUploadProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/whatsapp', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    });
  },
  getSources: (params) => api.get('/import/sources', { params }),
  getSource: (id) => api.get(`/import/sources/${id}`),
  deleteSource: (id) => api.delete(`/import/sources/${id}`),
  reprocessSource: (id) => api.post(`/import/sources/${id}/reprocess`),
};

// Query API
export const queryAPI = {
  search: (data) => api.post('/query', data),
  getFragment: (id) => api.get(`/query/fragments/${id}`),
  getRelatedFragments: (id, params) => api.get(`/query/fragments/${id}/related`, { params }),
  getHistory: (params) => api.get('/query/history', { params }),
};

// Link API
export const linkAPI = {
  create: (data) => api.post('/links', data),
  getFragmentLinks: (fragmentId, params) => api.get(`/links/fragments/${fragmentId}`, { params }),
  update: (id, data) => api.patch(`/links/${id}`, data),
  delete: (id) => api.delete(`/links/${id}`),
  getSuggestions: (fragmentId, params) => api.get(`/links/fragments/${fragmentId}/suggestions`, { params }),
  rebuild: (data) => api.post('/links/rebuild', data),
  getClusters: (params) => api.get('/links/clusters', { params }),
  getAll: (params) => api.get('/links', { params }),
};

// Fragments API
export const fragmentsAPI = {
  getFragments: (params) => api.get('/fragments', { params }),
  getStatus: () => api.get('/status'),
  getGraph: (params) => api.get('/graph', { params }),
  getTimeline: (params) => api.get('/timeline', { params }),
};

// Helper functions for Dashboard
export const getRecentFragments = async (limit = 5) => {
  const response = await api.get('/fragments', { params: { limit, page: 1 } });
  return response.data.results || [];
};

export const getStats = async () => {
  const response = await api.get('/status');
  return response.data;
};

// Fragment-specific functions
export const getFragment = async (id) => {
  const response = await queryAPI.getFragment(id);
  return response.data;
};

export const updateFragment = async (id, data) => {
  const response = await api.patch(`/fragments/${id}`, data);
  return response.data;
};

export const deleteFragment = async (id) => {
  const response = await api.delete(`/fragments/${id}`);
  return response.data;
};

export const getRelatedFragments = async (id, params) => {
  const response = await queryAPI.getRelatedFragments(id, params);
  return response.data.related || [];
};

export const createLink = async (sourceId, targetId, type) => {
  const response = await linkAPI.create({ sourceFragmentId: sourceId, targetFragmentId: targetId, type });
  return response.data;
};

// Search function
export const searchFragments = async (query, options = {}) => {
  const response = await queryAPI.search({ q: query, ...options });
  return response.data;
};

// Settings/Profile functions
export const getProfile = async () => {
  const response = await authAPI.getCurrentUser();
  return response.data.user || response.data;
};

export const updateProfile = async (data) => {
  const response = await api.patch('/auth/profile', data);
  return response.data;
};

export const changePassword = async (data) => {
  const response = await api.post('/auth/change-password', data);
  return response.data;
};

export const deleteAccount = async () => {
  const response = await api.delete('/auth/account');
  return response.data;
};

// Upload functions
export const getUploads = async () => {
  const response = await importAPI.getSources();
  return response.data.results || response.data || [];
};

export const uploadFile = async (file, onUploadProgress) => {
  // Detect if it's a WhatsApp file by name or content
  const isWhatsApp = file.name.toLowerCase().includes('whatsapp') ||
    file.name.toLowerCase().includes('chat');

  if (isWhatsApp && file.type === 'text/plain') {
    // Try WhatsApp-specific upload
    try {
      const response = await importAPI.uploadWhatsApp(file, onUploadProgress);
      return response.data;
    } catch (error) {
      // Fallback to regular upload if WhatsApp parsing fails
      console.warn('WhatsApp upload failed, trying regular upload:', error);
    }
  }

  // Regular upload
  const response = await importAPI.upload(file, onUploadProgress);
  return response.data;
};

export const deleteUpload = async (id) => {
  const response = await importAPI.deleteSource(id);
  return response.data;
};

// Create Query Client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000, // 1 second - ensure freshness for fast updates
    },
  },
});

export default api;
