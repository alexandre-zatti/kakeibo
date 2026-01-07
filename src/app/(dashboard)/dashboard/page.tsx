export default function DashboardPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center px-4">
          <h1 className="text-xl font-semibold">Kakeibo Dashboard</h1>
        </div>
      </header>
      <main className="flex-1 p-8">
        <h2 className="mb-4 text-2xl font-bold">Welcome to your dashboard</h2>
        <p className="text-muted-foreground">Start tracking your finances with Kakeibo.</p>
      </main>
    </div>
  );
}
