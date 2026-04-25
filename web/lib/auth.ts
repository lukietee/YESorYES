import { NextResponse } from "next/server";

export function requireBearer(req: Request): NextResponse | null {
  const expected = process.env.INTERNAL_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "INTERNAL_TOKEN not configured" },
      { status: 500 },
    );
  }
  const got = req.headers.get("authorization");
  if (got !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
