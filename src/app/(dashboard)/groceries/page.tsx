import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPurchases } from "@/services/purchase";
import { PurchasesDataTable } from "@/components/purchases/purchases-data-table";

export default async function GroceriesPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const purchases = await getPurchases({ userId: session.user.id });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Groceries</h1>
        <p className="text-muted-foreground">View and manage your grocery purchases</p>
      </div>

      <PurchasesDataTable data={purchases} />
    </div>
  );
}
