import type { NextRequest } from "next/server";
import { isApiRequest, proxyApiRequest } from "@/proxy/api-proxy";
import { pageAuthGuard } from "@/proxy/auth-guard";

export async function middleware(request: NextRequest): Promise<Response> {
  if (isApiRequest(request)) {
    return proxyApiRequest(request);
  }
  return pageAuthGuard(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
