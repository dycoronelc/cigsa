// Configuration file for API and static file URLs
// In production, these will be set via environment variables

// API base URL - defaults to '/api' for production (Nginx proxy)
// For development, you can set VITE_API_URL=http://localhost:3001/api
export const API_URL = import.meta.env.VITE_API_URL || '/api';

// Static files base URL - for images, documents, etc.
// In production, set VITE_STATIC_URL to the same origin as the API so /uploads/photos/... loads from backend.
// Nginx must proxy /uploads to the backend. For development: VITE_STATIC_URL=http://localhost:3001
export const STATIC_URL = import.meta.env.VITE_STATIC_URL || '';

// Base URL for static files when STATIC_URL is not set: derive from API_URL so images load from API host
function getStaticBaseUrl() {
  if (STATIC_URL) return STATIC_URL;
  const api = API_URL;
  if (api.startsWith('http://') || api.startsWith('https://')) {
    try {
      const u = new URL(api);
      return u.origin;
    } catch (_) {
      return '';
    }
  }
  return '';
}

// Helper function to get full URL for static files
export const getStaticUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const normalized = path.startsWith('/') ? path : `/${path}`;

  if (STATIC_URL) {
    const base = STATIC_URL.replace(/\/$/, '');
    return `${base}${normalized}`;
  }

  // Archivos bajo /uploads: el backend los expone en /uploads y también en /api/uploads
  // (para que un solo proxy Nginx/Vite hacia /api sirva documentos sin caer en el SPA).
  if (normalized.startsWith('/uploads/')) {
    const api = (API_URL || '/api').replace(/\/$/, '');
    if (!api.startsWith('http://') && !api.startsWith('https://')) {
      if (typeof window !== 'undefined' && window.location?.origin) {
        return `${window.location.origin}${api}${normalized}`;
      }
    }
    if (api.startsWith('http://') || api.startsWith('https://')) {
      try {
        const u = new URL(api);
        return `${u.origin}${normalized}`;
      } catch (_) {
        /* fall through */
      }
    }
  }

  const base = getStaticBaseUrl();
  return base ? `${base}${normalized}` : normalized;
};
