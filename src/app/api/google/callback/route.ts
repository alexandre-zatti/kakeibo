import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { getHouseholdByUserId } from "@/services/household";
import { exchangeCodeForTokens, getOAuth2Client } from "@/lib/google";
import { prisma } from "@/lib/prisma";
import logger, { serializeError } from "@/lib/logger";

const log = logger.child({ module: "api/google/callback" });

const ADAPTERS_URL = "/finances/adapters";

function redirectTo(path: string) {
  return NextResponse.redirect(new URL(path, process.env.BETTER_AUTH_URL));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    log.warn({ error }, "Google OAuth denied by user");
    return redirectTo(`${ADAPTERS_URL}?google=denied`);
  }

  if (!code || !state) {
    return redirectTo(`${ADAPTERS_URL}?google=error`);
  }

  try {
    // Verify auth
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return redirectTo("/login");
    }

    // Decode state and verify household ownership
    const { householdId } = JSON.parse(Buffer.from(state, "base64url").toString()) as {
      householdId: number;
    };

    const household = await getHouseholdByUserId(session.user.id);
    if (!household || household.id !== householdId) {
      log.warn({ householdId }, "Household mismatch in Google OAuth callback");
      return redirectTo(`${ADAPTERS_URL}?google=error`);
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      log.error("Missing tokens from Google OAuth exchange");
      return redirectTo(`${ADAPTERS_URL}?google=error`);
    }

    // Fetch user email
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    const data = {
      email: userInfo.email ?? "unknown",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      scopes: tokens.scope ?? "",
    };

    await prisma.googleConnection.upsert({
      where: { householdId },
      create: { householdId, ...data },
      update: data,
    });

    return redirectTo(`${ADAPTERS_URL}?google=connected`);
  } catch (err) {
    log.error({ error: serializeError(err) }, "Google OAuth callback failed");
    return redirectTo(`${ADAPTERS_URL}?google=error`);
  }
}
