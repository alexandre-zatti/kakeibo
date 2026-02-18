import { prisma } from "@/lib/prisma";
import logger, { serializeError } from "@/lib/logger";
import type { HouseholdWithMembers } from "@/types/finances";
import type { CreateHouseholdInput } from "@/lib/schemas/finances";
import { seedDefaultCategories } from "@/services/category";

const log = logger.child({ module: "services/household" });

const memberInclude = {
  members: {
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  },
} as const;

export async function getHouseholdByUserId(userId: string): Promise<HouseholdWithMembers | null> {
  log.debug({ userId }, "Fetching household for user");

  try {
    const member = await prisma.householdMember.findFirst({
      where: { userId },
      include: {
        household: { include: memberInclude },
      },
    });

    if (!member) return null;

    return member.household;
  } catch (error) {
    log.error({ error: serializeError(error), userId }, "Failed to fetch household");
    throw error;
  }
}

export async function createHousehold(
  userId: string,
  data: CreateHouseholdInput
): Promise<HouseholdWithMembers> {
  log.debug({ userId, name: data.name }, "Creating household");

  try {
    const household = await prisma.$transaction(async (tx) => {
      const h = await tx.household.create({
        data: {
          name: data.name,
          members: {
            create: { userId, role: "owner" },
          },
        },
        include: memberInclude,
      });

      await seedDefaultCategories(h.id, tx);

      return h;
    });

    log.info({ householdId: household.id, userId }, "Household created");
    return household;
  } catch (error) {
    log.error({ error: serializeError(error), userId }, "Failed to create household");
    throw error;
  }
}

export async function addHouseholdMember(
  householdId: number,
  email: string,
  requestingUserId: string
): Promise<{ success: boolean; error?: string }> {
  log.debug({ householdId, email, requestingUserId }, "Adding household member");

  try {
    // Verify requester is owner
    const requester = await prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId, userId: requestingUserId } },
    });

    if (!requester || requester.role !== "owner") {
      return { success: false, error: "Apenas o dono pode adicionar membros" };
    }

    // Find user by email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { success: false, error: "Usuário não encontrado" };
    }

    // Check not already a member
    const existing = await prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId, userId: user.id } },
    });

    if (existing) {
      return { success: false, error: "Usuário já é membro" };
    }

    await prisma.householdMember.create({
      data: { householdId, userId: user.id, role: "member" },
    });

    log.info({ householdId, email, requestingUserId }, "Household member added");
    return { success: true };
  } catch (error) {
    log.error({ error: serializeError(error), householdId, email }, "Failed to add member");
    throw error;
  }
}

export async function removeHouseholdMember(
  householdId: number,
  memberId: number,
  requestingUserId: string
): Promise<{ success: boolean; error?: string }> {
  log.debug({ householdId, memberId, requestingUserId }, "Removing household member");

  try {
    // Verify requester is owner
    const requester = await prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId, userId: requestingUserId } },
    });

    if (!requester || requester.role !== "owner") {
      return { success: false, error: "Apenas o dono pode remover membros" };
    }

    const member = await prisma.householdMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.householdId !== householdId) {
      return { success: false, error: "Membro não encontrado" };
    }

    if (member.role === "owner") {
      return { success: false, error: "Não é possível remover o dono" };
    }

    await prisma.householdMember.delete({ where: { id: memberId } });

    log.info({ householdId, memberId, requestingUserId }, "Household member removed");
    return { success: true };
  } catch (error) {
    log.error({ error: serializeError(error), householdId, memberId }, "Failed to remove member");
    throw error;
  }
}
