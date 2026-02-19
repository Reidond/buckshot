import { NextResponse } from "next/server";

export async function GET(_: Request, _params: { params: Promise<{ id: string }> }) {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}

export async function PATCH(_: Request, _params: { params: Promise<{ id: string }> }) {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}

export async function DELETE(_: Request, _params: { params: Promise<{ id: string }> }) {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
