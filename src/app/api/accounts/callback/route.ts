import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // TODO: OAuth callback — exchange code, validate channel, store encrypted token
  const url = new URL(request.url);
  const _code = url.searchParams.get("code");
  const _state = url.searchParams.get("state");
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
