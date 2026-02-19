import { NextResponse } from "next/server";

export async function GET() {
  // TODO: fetch from D1 via getRequestContext
  return NextResponse.json({ projects: [], total: 0 });
}

export async function POST() {
  // TODO: validate body with AddProjectSchema, encrypt clientSecret, insert to D1
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
