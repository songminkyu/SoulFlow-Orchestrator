export class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`API ${status}`);
  }
}

/** G-12: cross-team 거부 이벤트 타입 */
export interface CrossTeamDeniedDetail {
  team_id?: string;
  resource_team_id?: string;
}

/** G-12: 전역 cross-team 거부 감지 — window 이벤트로 최상위 레이아웃에 전달 */
function emit_cross_team_denied(detail: CrossTeamDeniedDetail): void {
  window.dispatchEvent(new CustomEvent("cross-team-denied", { detail }));
}


const REQUEST_TIMEOUT = 30_000; // 30초
const MAX_RETRIES = 2; // 최대 2회 재시도

async function request<T>(path: string, init?: RequestInit, attempt: number = 1): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const res = await fetch(path, { cache: "no-store", ...init, signal: controller.signal });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      // G-12: 전역 cross-team 거부 인터셉터 — 403 + cross_team_denied 코드
      if (res.status === 403) {
        const err_body = body as { error?: string | { code?: string; team_id?: string; resource_team_id?: string } } | null;
        if (typeof err_body?.error === "object" && err_body.error?.code === "cross_team_denied") {
          emit_cross_team_denied({
            team_id: err_body.error.team_id,
            resource_team_id: err_body.error.resource_team_id,
          });
        } else {
          window.dispatchEvent(new CustomEvent("api-forbidden", { detail: { path, body } }));
        }
      }

      throw new ApiError(res.status, body);
    }
    return res.json() as Promise<T>;
  } catch (err) {
    // 네트워크 오류 또는 타임아웃이고 재시도 가능한 경우
    if ((err instanceof TypeError || err instanceof DOMException) && attempt < MAX_RETRIES + 1) {
      // 지수 백오프: 1초, 2초
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
      return request<T>(path, init, attempt + 1);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export const api = {
  get: <T = unknown>(path: string) => request<T>(path),
  post: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", headers: JSON_HEADERS, body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", headers: JSON_HEADERS, body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", headers: JSON_HEADERS, body: body !== undefined ? JSON.stringify(body) : undefined }),
  del: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, { method: "DELETE", headers: JSON_HEADERS, body: body !== undefined ? JSON.stringify(body) : undefined }),
};
