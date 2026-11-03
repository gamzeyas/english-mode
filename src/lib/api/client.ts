/** Browser-side helper for the app's JSON API error contract. */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string; error: string };

const NETWORK_ERROR = "Bağlantı sorunu. İnternetini kontrol edip tekrar dene.";

async function request<T>(
  method: "GET" | "POST",
  url: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers:
        body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, code: "network", error: NETWORK_ERROR };
  }

  const json = await response.json().catch(() => null);
  if (response.ok) return { ok: true, data: json as T };
  if (response.status === 401) {
    // Full reload on an expired session so no signed-in state survives.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(
      `/login?next=${encodeURIComponent(window.location.pathname)}`,
    );
  }
  return {
    ok: false,
    status: response.status,
    code: json?.error?.code ?? "unknown",
    error: json?.error?.message ?? "Beklenmeyen bir hata oluştu.",
  };
}

export const postJson = <T>(url: string, body?: unknown) =>
  request<T>("POST", url, body ?? {});
export const getJson = <T>(url: string) => request<T>("GET", url);
