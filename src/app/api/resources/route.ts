import { NextResponse } from "next/server";
import { isResourceKind, listResourcesFromCluster } from "@/lib/server/k8s";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");

  if (!kind) {
    return NextResponse.json(
      {
        error: "Missing query param: kind"
      },
      { status: 400 }
    );
  }

  if (!isResourceKind(kind)) {
    return NextResponse.json(
      {
        error: `Unsupported resource kind: ${kind}`
      },
      { status: 400 }
    );
  }

  try {
    const resources = await listResourcesFromCluster(kind);
    return NextResponse.json(resources);
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: `Failed to load resources for kind: ${kind}`,
        details
      },
      { status: 500 }
    );
  }
}
