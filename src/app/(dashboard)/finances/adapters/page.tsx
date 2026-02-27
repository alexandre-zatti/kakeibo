import { redirect } from "next/navigation";
import { getHouseholdByUserId } from "@/services/household";
import { getAdapters } from "@/services/adapter";
import { getAdapterRuns } from "@/services/adapter-run";
import { getAvailableModules } from "@/adapters/modules";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { AdapterList } from "@/components/adapters/adapter-list";

export default async function AdaptersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const household = await getHouseholdByUserId(session.user.id);
  if (!household) redirect("/finances");

  const [adapters, runs] = await Promise.all([
    getAdapters(household.id),
    getAdapterRuns(household.id),
  ]);

  const availableModules = getAvailableModules();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Adaptadores</h1>
      </div>
      <AdapterList adapters={adapters} runs={runs} availableModules={availableModules} />
    </div>
  );
}
