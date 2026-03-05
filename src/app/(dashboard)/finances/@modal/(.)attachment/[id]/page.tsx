import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getHouseholdByUserId } from "@/services/household";
import { prisma } from "@/lib/prisma";
import { AttachmentViewer } from "@/components/adapters/attachment-viewer";
import { AttachmentModal } from "@/components/adapters/attachment-modal";

export default async function AttachmentInterceptedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
  });

  if (!expense?.attachmentPath) redirect("/finances");

  return (
    <AttachmentModal title={expense.description}>
      <AttachmentViewer filePath={expense.attachmentPath} />
    </AttachmentModal>
  );
}
