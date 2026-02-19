import { NextResponse } from "next/server";

export async function POST() {
  // TODO: generate R2 presigned URL for direct browser upload
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
