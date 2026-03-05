/**
 * Exposes cluster issue data to the frontend from server-side Kubernetes integrations.
 */
import { NextResponse } from "next/server";
import { listIssuesFromCluster } from "@/lib/server/k8s";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Loads issues from the cluster and normalizes failures into API-safe responses.
export async function GET() {
  try {
    const issues = await listIssuesFromCluster();
    return NextResponse.json(issues);
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to load issues from Kubernetes API",
        details
      },
      { status: 500 }
    );
  }
}
