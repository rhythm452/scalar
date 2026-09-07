import type { NextRequest } from "next/server";

const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:8000";

export function isApiRequest(request: NextRequest): boolean {
  return request.nextUrl.pathname.startsWith("/api/");
}

export async function proxyApiRequest(request: NextRequest): Promise<Response> {
  const target = new URL(request.nextUrl.pathname + request.nextUrl.search, API_ORIGIN);
  const headers = new Headers(request.headers);
  headers.set("X-Forwarded-Host", request.headers.get("host") ?? "");

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.body,
      redirect: "manual",
      // @ts-expect-error duplex is required to stream request bodies in Node/Edge runtimes
      duplex: "half",
    });

    const responseHeaders = new Headers(upstream.headers);
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Origin unreachable";
    return new Response(
      JSON.stringify({
        Error: {
          Type: "Receiver",
          Code: "ServiceUnavailable",
          Message: message,
        },
        RequestId: crypto.randomUUID(),
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
