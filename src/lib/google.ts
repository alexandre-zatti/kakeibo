import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";

const log = logger.child({ module: "lib/google" });

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

function getRedirectUri() {
  return `${process.env.BETTER_AUTH_URL}/api/google/callback`;
}

export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google OAuth credentials not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)"
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, getRedirectUri());
}

export function getAuthorizationUrl(state: string) {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function getAuthenticatedClient(householdId: number) {
  const connection = await prisma.googleConnection.findUnique({
    where: { householdId },
  });

  if (!connection) {
    throw new Error("Google não conectado.");
  }

  const client = getOAuth2Client();
  client.setCredentials({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken,
    expiry_date: connection.expiresAt.getTime(),
  });

  client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      const expiresAt = tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : new Date(Date.now() + 3600 * 1000);
      try {
        await prisma.googleConnection.update({
          where: { householdId },
          data: { accessToken: tokens.access_token, expiresAt },
        });
      } catch (err) {
        log.error({ err, householdId }, "Failed to persist refreshed Google tokens");
      }
    }
  });

  return client;
}

export async function getGmailClient(householdId: number) {
  const auth = await getAuthenticatedClient(householdId);
  return google.gmail({ version: "v1", auth });
}

export async function getDriveClient(householdId: number) {
  const auth = await getAuthenticatedClient(householdId);
  return google.drive({ version: "v3", auth });
}
