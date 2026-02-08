export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  used_indexes: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationSummary extends Organization {
  index_count: number;
  source_count: number;
  application_count: number;
  dashboard_count: number;
  provider_configured: boolean;
}

// ── Provider config ─────────────────────────────────────────────────

export interface ProviderConfigCreate {
  provider_type: string;
  host_url: string;
  auth_type: string;
  credentials: { cookie: string; csrf_token: string };
}

export interface ProviderConfigResponse {
  provider_type: string;
  host_url: string;
  auth_type: string;
  is_configured: boolean;
  last_synced_at: string | null;
}

export interface ProviderTestResult {
  success: boolean;
  message: string;
  details: Record<string, unknown> | null;
}

export interface SyncResult {
  success: boolean;
  message: string;
  indexes_synced: number;
  applications_synced: number;
  dashboards_synced: number;
}

// ── Index / Source ───────────────────────────────────────────────────

export interface IndexItem {
  id: string;
  organization_id: string;
  name: string;
  external_id: string | null;
  description: string | null;
  config: Record<string, unknown> | null;
  is_active: boolean;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SourceItem {
  id: string;
  organization_id: string;
  repository_id: string;
  name: string;
  total_count: number | null;
  last_event_at: string | null;
  first_event_at: string | null;
  category: string | null;
  description: string | null;
  is_active: boolean;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SourceSyncResult {
  success: boolean;
  message: string;
  sources_synced: number;
}

export interface SourceSearchRequest {
  search: string;
  repository_id?: string;
}

export interface SourceSearchResult {
  id: string;
  organization_id: string;
  repository_id: string;
  repository_name: string;
  name: string;
  total_count: number | null;
  last_event_at: string | null;
  first_event_at: string | null;
}

export interface SourceSearchResponse {
  matches: SourceSearchResult[];
}

// ── Search ──────────────────────────────────────────────────────────

export interface LogSearchRequest {
  index: string;
  source?: string;
  query?: string[]; // List of query strings (each will be quoted in SPL)
  from_time: string; // ISO 8601
  to_time: string;   // ISO 8601
  max_results?: number;
}

export interface LogSearchResponse {
  data: Record<string, unknown>[];
}
