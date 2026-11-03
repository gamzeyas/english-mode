/** Browser-side helper for the app's JSON API error contract. */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string; error: string };

const NETWORK_ERROR = "Bağlantı sorunu. İnternetini kontrol edip tekrar dene.";

async function request<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  url: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    const isForm = body instanceof FormData;
    response = await fetch(url, {
      method,
      headers:
        body === undefined || isForm
          ? undefined
          : { "content-type": "application/json" },
      body:
        body === undefined || isForm
          ? (body as FormData | undefined)
          : JSON.stringify(body),
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
export const patchJson = <T>(url: string, body: unknown) =>
  request<T>("PATCH", url, body);
export const deleteJson = <T>(url: string, body?: unknown) =>
  request<T>("DELETE", url, body);
/** Multipart upload (e.g. audio); same error contract as the JSON helpers. */
export const postForm = <T>(url: string, form: FormData) =>
  request<T>("POST", url, form);
