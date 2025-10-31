import { NextRequest, NextResponse } from "next/server";
import { listApprovedProjects, listPendingProjects, updateProjectStatus } from "@/lib/storage";

export async function GET() {
  const [pending, approved] = await Promise.all([
    listPendingProjects(),
    listApprovedProjects()
  ]);
  return NextResponse.json({ pending, approved });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.id || !body?.action) {
    return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
  }

  if (!["approved", "rejected"].includes(body.action)) {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const { approved, pending } = await updateProjectStatus(body.id, body.action);
  return NextResponse.json({ approved, pending });
}
