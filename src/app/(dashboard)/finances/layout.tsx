import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getHouseholdByUserId } from "@/services/household";
import { HouseholdProvider } from "@/components/finances/household-context";
import { HouseholdSetup } from "@/components/finances/household-setup";

export default async function FinancesLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.id) {
    return null;
  }

  const household = await getHouseholdByUserId(session.user.id);

  if (!household) {
    return <HouseholdSetup />;
  }

  return <HouseholdProvider householdId={household.id}>{children}</HouseholdProvider>;
}
