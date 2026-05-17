import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { runCodexRunnerImageSmoke } from "@/services/codex-runner-smoke";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function timingSafeEqualString(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.KAKEIBO_INTERNAL_WEBHOOK_SECRET;
  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  const headerSecret = request.headers.get("x-kakeibo-internal-secret") ?? "";
  const candidate = bearer || headerSecret;

  return Boolean(candidate) && timingSafeEqualString(candidate, secret);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    );
  }

  const result = await runCodexRunnerImageSmoke();
  return NextResponse.json(result, {
    status: result.ok ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
