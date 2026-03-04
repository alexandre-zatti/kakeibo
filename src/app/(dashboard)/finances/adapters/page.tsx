import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getHouseholdByUserId } from "@/services/household";
import { getAdapters } from "@/services/adapter";
import { getAdapterRuns } from "@/services/adapter-run";
import { getCategoriesByHousehold } from "@/services/category";
import { getAvailableModules } from "@/adapters/modules";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { AdapterList } from "@/components/adapters/adapter-list";
import { GoogleConnectionCard } from "@/components/adapters/google-connection-card";

export default async function AdaptersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const household = await getHouseholdByUserId(session.user.id);
  if (!household) redirect("/finances");

  const [adapters, runs, googleConnection, categories] = await Promise.all([
    getAdapters(household.id),
    getAdapterRuns(household.id),
    prisma.googleConnection.findUnique({ where: { householdId: household.id } }),
    getCategoriesByHousehold(household.id, "expense"),
  ]);

  const availableModules = getAvailableModules();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Adaptadores</h1>
      </div>
      <Suspense>
        <GoogleConnectionCard email={googleConnection?.email ?? null} />
      </Suspense>
      <AdapterList
        adapters={adapters}
        runs={runs}
        availableModules={availableModules}
        categories={categories}
      />
    </div>
  );
}
