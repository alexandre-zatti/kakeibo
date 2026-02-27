import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getHouseholdByUserId } from "@/services/household";
import { getSavingsBoxById } from "@/services/savings-box";
import { SavingsBoxDetail } from "@/components/finances/savings-box-detail";

interface CaixinhaDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CaixinhaDetailPage({ params }: CaixinhaDetailPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;

  const household = await getHouseholdByUserId(session.user.id);
  if (!household) return null;

  const { id } = await params;
  const boxId = parseInt(id, 10);
  if (isNaN(boxId)) notFound();

  const box = await getSavingsBoxById(boxId, household.id);
  if (!box) notFound();

  return <SavingsBoxDetail box={box} />;
}
