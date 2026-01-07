import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <h1 className="text-xl font-semibold">Kakeibo</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{session.user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-8">
        <h2 className="mb-4 text-2xl font-bold">
          Welcome{session.user.name ? `, ${session.user.name}` : ""}
        </h2>
        <p className="text-muted-foreground">Start tracking your finances with Kakeibo.</p>
      </main>
    </div>
  );
}
