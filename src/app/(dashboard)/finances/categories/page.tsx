import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getHouseholdByUserId } from "@/services/household";
import { getCategoriesByHousehold } from "@/services/category";
import { CategoryList } from "@/components/finances/category-list";

export default async function CategoriesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;

  const household = await getHouseholdByUserId(session.user.id);
  if (!household) return null;

  const categories = await getCategoriesByHousehold(household.id);

  const incomeCategories = categories.filter((c) => c.type === "income");
  const expenseCategories = categories.filter((c) => c.type === "expense");

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Categorias</h1>
      <CategoryList title="Receitas" type="income" categories={incomeCategories} />
      <CategoryList title="Despesas" type="expense" categories={expenseCategories} />
    </div>
  );
}
