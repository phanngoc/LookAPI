import { Project } from '@/types/api';

const DEFAULT_BASE_URL = 'http://localhost:8080';
const DCCARD_BASE_URL = 'http://localhost:8082';

/**
 * Get the base URL for a project.
 * Priority: project.baseUrl > environmentBaseUrl > default (based on service)
 * 
 * @param project - The current project
 * @param environmentBaseUrl - Base URL from environment variables (e.g., {{BASE_URL}})
 * @param service - Optional service name to determine default URL
 * @returns The resolved base URL
 */
export function getBaseUrlForProject(
  project: Project | null,
  environmentBaseUrl?: string,
  service?: string
): string {
  // Priority 1: Project's base URL setting (ghi đè environment)
  if (project?.baseUrl) {
    return project.baseUrl;
  }

  // Priority 2: Environment base URL
  if (environmentBaseUrl) {
    return environmentBaseUrl;
  }

  // Priority 3: Service-based default
  if (service === 'dccard') {
    return DCCARD_BASE_URL;
  }

  // Default
  return DEFAULT_BASE_URL;
}

/**
 * Build full URL from base URL and path
 * 
 * @param baseUrl - The base URL
 * @param path - The API path
 * @returns Full URL
 */
export function buildFullUrl(baseUrl: string, path: string): string {
  // Remove trailing slash from base URL and ensure path starts with /
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBaseUrl}${cleanPath}`;
}

/**
 * Validate URL format
 * 
 * @param url - URL string to validate
 * @returns true if valid URL format
 */
export function isValidUrl(url: string): boolean {
  if (!url || url.trim() === '') {
    return true; // Empty is allowed (will use default)
  }
  
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
