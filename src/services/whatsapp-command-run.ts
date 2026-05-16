import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const WhatsappCommandRunStatus = {
  QUEUED: "queued",
  PROCESSING: "processing",
  WAITING_REVIEW: "waiting_review",
  APPROVED: "approved",
  REJECTED: "rejected",
  FAILED: "failed",
  IGNORED: "ignored",
} as const;

export type WhatsappCommandRunStatusType =
  (typeof WhatsappCommandRunStatus)[keyof typeof WhatsappCommandRunStatus];

export async function createCommandRun(input: {
  command: string;
  mode: string;
  chatId: string;
  inboundMessageId: string;
  mediaPath?: string | null;
}) {
  try {
    return await prisma.whatsappCommandRun.create({
      data: {
        command: input.command,
        mode: input.mode,
        chatId: input.chatId,
        inboundMessageId: input.inboundMessageId,
        mediaPath: input.mediaPath ?? null,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return prisma.whatsappCommandRun.findUnique({
        where: { inboundMessageId: input.inboundMessageId },
      });
    }

    throw error;
  }
}

export async function updateCommandRun(
  id: number,
  data: {
    status?: WhatsappCommandRunStatusType;
    outboundAckMessageId?: string | null;
    outboundProposalMessageId?: string | null;
    entityType?: string | null;
    entityId?: number | null;
    mediaPath?: string | null;
    errorMessage?: string | null;
    completedAt?: Date | null;
  }
) {
  return prisma.whatsappCommandRun.update({
    where: { id },
    data,
  });
}

export async function claimQueuedCommandRun(id: number): Promise<boolean> {
  const result = await prisma.whatsappCommandRun.updateMany({
    where: {
      id,
      status: WhatsappCommandRunStatus.QUEUED,
      entityId: null,
    },
    data: {
      status: WhatsappCommandRunStatus.PROCESSING,
    },
  });

  return result.count === 1;
}

export async function findCommandRunByInboundMessageId(inboundMessageId: string) {
  return prisma.whatsappCommandRun.findUnique({
    where: { inboundMessageId },
  });
}

export async function findCommandRunByProposalMessageId(outboundProposalMessageId: string) {
  return prisma.whatsappCommandRun.findFirst({
    where: { outboundProposalMessageId },
  });
}

export function isTerminalCommandRunStatus(status: string): boolean {
  const terminalStatuses: readonly string[] = [
    WhatsappCommandRunStatus.APPROVED,
    WhatsappCommandRunStatus.REJECTED,
    WhatsappCommandRunStatus.FAILED,
    WhatsappCommandRunStatus.IGNORED,
  ];

  return terminalStatuses.includes(status);
}
