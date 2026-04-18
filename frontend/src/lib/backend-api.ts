export type Domain = "ppna" | "sap" | "pe" | "pb" | "ibnr";
export type BackendRole = "ADMIN" | "HR" | "VIEWER";
export type BackendStatus = "ACTIVE" | "SUSPENDED";

export interface SessionUser {
  session_id?: string;
  user_id: string;
  username: string;
  role: BackendRole;
  status: BackendStatus;
}

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

export interface TokenEnvelope {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: SessionUser;
}

export interface DashboardSummary {
  domains: Partial<Record<Domain, { run_id: string; finished_at: string; total: number }>>;
  grand_total: number;
  completed_domains: number;
  expected_domains: number;
}

export interface DashboardAlerts {
  alerts: Array<Record<string, unknown> & { type: string; message: string }>;
}

export interface DashboardTimeline {
  events: Array<{
    event_id: string;
    actor_user_id: string | null;
    action: string;
    target_type: string;
    target_id: string;
    occurred_at: string;
  }>;
}

export interface DashboardCompletion {
  domains: Record<Domain, { completed: boolean }>;
}

export interface BilanCurrent {
  generated_at: string;
  totals: Partial<Record<Domain, number>>;
  grand_total: number;
  source_runs: Partial<Record<Domain, string>>;
}

export interface BilanSnapshot extends BilanCurrent {
  snapshot_id: string;
  created_at?: string;
  created_by?: string;
}

export interface AuditEvent {
  event_id: string;
  actor_user_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  occurred_at: string;
  ip_address: string | null;
  user_agent: string | null;
  payload: Record<string, unknown>;
  previous_event_hash: string | null;
  event_hash: string;
}

export interface DomainDocument {
  document_id: string;
  domain: Domain;
  original_filename: string;
  created_at: string;
  created_by: string;
  current_version_id: string;
  status: string;
  sha256?: string;
  uploaded_at?: string;
  uploaded_by?: string;
  downloads?: {
    xlsx: string;
    csv: string;
    txt: string;
  };
}

export interface DomainRun {
  run_id: string;
  domain: Domain;
  document_version_id: string;
  parameters: Record<string, unknown>;
  status: string;
  started_at: string;
  finished_at: string | null;
  started_by: string;
  error_message: string | null;
  artifacts: {
    result: string;
    rows: string;
    cleaning_report: string;
  };
}

const SESSION_STORAGE_KEY = "lav.backend.session";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/+$/, "");

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function isBrowser() {
  return typeof window !== "undefined";
}

function buildUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/api/")) return path;
  if (path.startsWith("/")) return `${API_BASE_URL}${path}`;
  return `${API_BASE_URL}/${path}`;
}

function jsonHeaders(init?: HeadersInit) {
  return new Headers({
    Accept: "application/json",
    ...Object.fromEntries(new Headers(init).entries()),
  });
}

function readDetail(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "detail" in payload && typeof payload.detail === "string") {
    return payload.detail;
  }
  return fallback;
}

export function getStoredSession(): StoredSession | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function setStoredSession(session: StoredSession) {
  if (!isBrowser()) return;
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

function toStoredSession(payload: TokenEnvelope): StoredSession {
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    user: payload.user,
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    if (response.status === 204) {
      return undefined as T;
    }
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return (await response.json()) as T;
    }
    return (await response.text()) as T;
  }

  let errorPayload: unknown = null;
  const contentType = response.headers.get("content-type") || "";
  try {
    errorPayload = contentType.includes("application/json") ? await response.json() : await response.text();
  } catch {
    errorPayload = null;
  }
  throw new ApiError(response.status, readDetail(errorPayload, `Request failed with status ${response.status}.`));
}

async function refreshAccessToken(refreshToken: string): Promise<StoredSession> {
  const response = await fetch(buildUrl("auth/refresh"), {
    method: "POST",
    headers: jsonHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const payload = await parseResponse<TokenEnvelope>(response);
  const next = toStoredSession(payload);
  setStoredSession(next);
  return next;
}

async function authorizedFetch(path: string, init: RequestInit = {}, allowRetry = true): Promise<Response> {
  const session = getStoredSession();
  const headers = new Headers(init.headers);
  if (session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  let response = await fetch(buildUrl(path), { ...init, headers });
  if (response.status !== 401 || !allowRetry || !session?.refreshToken) {
    return response;
  }

  const nextSession = await refreshAccessToken(session.refreshToken);
  const retryHeaders = new Headers(init.headers);
  retryHeaders.set("Authorization", `Bearer ${nextSession.accessToken}`);
  response = await fetch(buildUrl(path), { ...init, headers: retryHeaders });
  return response;
}

async function getJson<T>(path: string, authenticated = true): Promise<T> {
  const response = authenticated
    ? await authorizedFetch(path, { headers: jsonHeaders() })
    : await fetch(buildUrl(path), { headers: jsonHeaders() });
  return parseResponse<T>(response);
}

async function postJson<T>(path: string, body: unknown, authenticated = true): Promise<T> {
  const init: RequestInit = {
    method: "POST",
    headers: jsonHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  };
  const response = authenticated ? await authorizedFetch(path, init) : await fetch(buildUrl(path), init);
  return parseResponse<T>(response);
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export async function getHealth() {
  return getJson<{ status: string }>("health", false);
}

export async function login(username: string, password: string) {
  const payload = await postJson<TokenEnvelope>("auth/login", { username, password }, false);
  const session = toStoredSession(payload);
  setStoredSession(session);
  return session;
}

export async function bootstrap(username: string, password: string) {
  const payload = await postJson<TokenEnvelope>("auth/bootstrap", { username, password }, false);
  const session = toStoredSession(payload);
  setStoredSession(session);
  return session;
}

export async function logout() {
  const session = getStoredSession();
  if (!session) return;
  try {
    await authorizedFetch("auth/logout", { method: "POST", headers: jsonHeaders() }, false);
  } finally {
    clearStoredSession();
  }
}

export async function getCurrentUser() {
  return getJson<SessionUser>("auth/me");
}

export async function getDashboardSummary() {
  return getJson<DashboardSummary>("dashboard/summary");
}

export async function getDashboardAlerts() {
  return getJson<DashboardAlerts>("dashboard/alerts");
}

export async function getDashboardTimeline() {
  return getJson<DashboardTimeline>("dashboard/timeline");
}

export async function getDashboardCompletion() {
  return getJson<DashboardCompletion>("dashboard/completion");
}

export async function getBilanCurrent() {
  return getJson<BilanCurrent>("bilan/current");
}

export async function listBilanHistory() {
  return getJson<BilanSnapshot[]>("bilan/history");
}

export async function createBilanSnapshot() {
  return postJson<BilanSnapshot>("bilan/snapshots", {});
}

export async function listAuditEvents(limit = 100) {
  return getJson<AuditEvent[]>(`audit/events?limit=${limit}`);
}

export async function searchDocuments(query = "", domain?: Domain) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (domain) params.set("domain", domain);
  return getJson<DomainDocument[]>(`documents/search?${params.toString()}`);
}

export async function listDomainDocuments(domain: Domain) {
  return getJson<DomainDocument[]>(`${domain}/documents`);
}

export async function getDomainDocument(domain: Domain, documentId: string) {
  return getJson<DomainDocument>(`${domain}/documents/${documentId}`);
}

export async function uploadDomainDocument(domain: Domain, file: File | Blob, filename: string, documentId?: string) {
  const params = new URLSearchParams({ filename });
  if (documentId) params.set("document_id", documentId);
  const response = await authorizedFetch(`${domain}/documents?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: file,
  });
  return parseResponse<DomainDocument>(response);
}

export async function createDomainRun(
  domain: Domain,
  payload: { document_id?: string; version_id?: string; parameters?: Record<string, unknown> },
) {
  return postJson<DomainRun>(`${domain}/runs`, payload);
}

export async function getDomainRun(domain: Domain, runId: string) {
  return getJson<DomainRun>(`${domain}/runs/${runId}`);
}

export async function getDomainRunRows(domain: Domain, runId: string) {
  return getJson<unknown>(`${domain}/runs/${runId}/rows`);
}

export async function getJsonArtifact<T>(path: string) {
  return getJson<T>(path);
}

export async function downloadAuthorizedFile(path: string, suggestedFilename?: string) {
  const response = await authorizedFetch(path, { method: "GET" });
  if (!response.ok) {
    await parseResponse(response);
    return;
  }
  const blob = await response.blob();
  if (!isBrowser()) return;

  const objectUrl = window.URL.createObjectURL(blob);
  const filename =
    suggestedFilename ||
    response.headers
      .get("Content-Disposition")
      ?.match(/filename="(.+)"/)?.[1] ||
    "download";

  const link = window.document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}
