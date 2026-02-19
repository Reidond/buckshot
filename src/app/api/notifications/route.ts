import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ notifications: [], total: 0, unread: 0 });
}
