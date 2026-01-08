import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";

// Use placeholder during build (Next.js imports this during static generation)
// Real secret is required at runtime
const secret = process.env.BETTER_AUTH_SECRET || "build-time-placeholder-not-for-production";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  secret,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
});
