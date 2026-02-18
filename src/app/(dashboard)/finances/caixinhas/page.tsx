import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getHouseholdByUserId } from "@/services/household";
import { getSavingsBoxes } from "@/services/savings-box";
import { SavingsBoxGrid } from "@/components/finances/savings-box-grid";

export default async function CaixinhasPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;

  const household = await getHouseholdByUserId(session.user.id);
  if (!household) return null;

  const boxes = await getSavingsBoxes(household.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Caixinhas</h1>
      </div>
      <SavingsBoxGrid boxes={boxes} />
    </div>
  );
}
