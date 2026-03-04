import { NextResponse } from "next/server";
import { getCodexAuthStatus } from "@/lib/server/codex-plan";
import type { CodexAuthStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getCodexAuthStatus();
  const response: CodexAuthStatus = {
    authenticated: status.authenticated,
    method: status.method,
    provider: status.provider,
    loginCommand: status.loginCommand,
    details: status.details
  };

  return NextResponse.json(response);
}
