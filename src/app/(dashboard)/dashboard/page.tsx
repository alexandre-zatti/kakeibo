import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">
        Welcome{session.user.name ? `, ${session.user.name}` : ""}
      </h1>
      <p className="text-muted-foreground">Teste Start tracking your finances with Kakeibo.</p>
    </div>
  );
}
