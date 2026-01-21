// Configuration file for API and static file URLs
// In production, these will be set via environment variables

// API base URL - defaults to '/api' for production (Nginx proxy)
// For development, you can set VITE_API_URL=http://localhost:3001/api
export const API_URL = import.meta.env.VITE_API_URL || '/api';

// Static files base URL - for images, documents, etc.
// In production, this will be handled by Nginx, so we use relative paths
// For development, you can set VITE_STATIC_URL=http://localhost:3001
export const STATIC_URL = import.meta.env.VITE_STATIC_URL || '';

// Helper function to get full URL for static files
export const getStaticUrl = (path) => {
  if (!path) return '';
  // If path already starts with http, return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  // Otherwise, prepend STATIC_URL
  return STATIC_URL ? `${STATIC_URL}${path}` : path;
};
