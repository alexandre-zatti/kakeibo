import { google } from "googleapis";

function getAuthClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const delegatedUser = process.env.GOOGLE_DELEGATED_USER_EMAIL;

  if (!email || !key) {
    throw new Error("Google service account credentials not configured");
  }

  const auth = new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, "\n"),
    scopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
    subject: delegatedUser,
  });

  return auth;
}

export async function getGmailClient() {
  const auth = getAuthClient();
  return google.gmail({ version: "v1", auth });
}

export async function getDriveClient() {
  const auth = getAuthClient();
  return google.drive({ version: "v3", auth });
}
