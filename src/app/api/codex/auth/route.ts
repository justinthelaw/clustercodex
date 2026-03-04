/**
 * Returns live Codex authentication readiness details for frontend status messaging.
 */
import { NextResponse } from "next/server";
import { getCodexAuthStatus } from "@/lib/server/codex/authStatus";
import type { CodexAuthStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reports the current server-side auth mode and availability state.
export async function GET() {
  const status = await getCodexAuthStatus();
  const response: CodexAuthStatus = {
    authenticated: status.authenticated,
    method: status.method,
    provider: status.provider,
    details: status.details
  };

  return NextResponse.json(response);
}
