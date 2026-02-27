import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getHouseholdByUserId } from "@/services/household";
import { prisma } from "@/lib/prisma";
import { AttachmentViewer } from "@/components/adapters/attachment-viewer";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function AttachmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const household = await getHouseholdByUserId(session.user.id);
  if (!household) redirect("/finances");

  const expense = await prisma.expenseEntry.findFirst({
    where: {
      id: parseInt(id, 10),
      monthlyBudget: { householdId: household.id },
    },
    include: { monthlyBudget: true },
  });

  if (!expense?.attachmentPath) redirect("/finances");

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link
            href={`/finances?year=${expense.monthlyBudget.year}&month=${expense.monthlyBudget.month}`}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">{expense.description}</h1>
      </div>
      <AttachmentViewer filePath={expense.attachmentPath} />
    </div>
  );
}
