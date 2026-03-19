async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const hasBody = options?.body !== undefined;
  const res = await fetch(url, {
    credentials: "include",
    headers: hasBody ? { "Content-Type": "application/json", ...options?.headers } : { ...options?.headers },
    ...options,
  });

  const data = await res.json();

  if (res.status === 401) {
    // Redirect to login if session expired, unless we're already on an auth endpoint
    if (!url.includes("/api/auth/")) {
      window.location.href = "/login";
    }
    throw new Error(data.error || "Необходима авторизация");
  }

  if (!res.ok || !data.ok) {
    const debugStr = data.debug ? ` | debug: ${JSON.stringify(data.debug)}` : "";
    throw new Error((data.error || `HTTP ${res.status}`) + debugStr);
  }

  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body: unknown) =>
    request<T>(url, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(url: string, body: unknown) =>
    request<T>(url, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(url: string, body: unknown) =>
    request<T>(url, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};
