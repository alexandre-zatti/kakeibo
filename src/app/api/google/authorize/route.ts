import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getHouseholdByUserId } from "@/services/household";
import { getAuthorizationUrl } from "@/lib/google";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", process.env.BETTER_AUTH_URL));
  }

  const household = await getHouseholdByUserId(session.user.id);

  if (!household) {
    return NextResponse.redirect(new URL("/finances", process.env.BETTER_AUTH_URL));
  }

  const state = Buffer.from(JSON.stringify({ householdId: household.id })).toString("base64url");
  const url = getAuthorizationUrl(state);

  return NextResponse.redirect(url);
}
