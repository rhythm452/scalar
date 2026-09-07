import { type NextRequest, NextResponse } from "next/server";
import { isApiRequest, proxyApiRequest } from "@/proxy/api-proxy";

export async function middleware(request: NextRequest): Promise<Response> {
  if (isApiRequest(request)) {
    return proxyApiRequest(request);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
