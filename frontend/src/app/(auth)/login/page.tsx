import type { Metadata } from "next";
import { LoginPageClient } from "@/components/login/login-page-client";
import { sanitizeNextParam } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return <LoginPageClient next={sanitizeNextParam(params.next)} />;
}
