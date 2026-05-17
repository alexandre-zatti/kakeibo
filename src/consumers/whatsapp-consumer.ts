import http from "node:http";

import { prisma } from "@/lib/prisma";
import logger, { serializeError } from "@/lib/logger";
import { createPurchaseFromReceiptData } from "@/services/grocery-import";
import {
  claimQueuedCommandRun,
  createCommandRun,
  findCommandRunByProposalMessageId,
  isTerminalCommandRunStatus,
  updateCommandRun,
  WhatsappCommandRunStatus,
} from "@/services/whatsapp-command-run";
import { PurchaseStatus } from "@/types/purchase";
import { getCommand, getHelpMessage, parseCommand } from "@/whatsapp/command-registry";
import {
  normalizeWahaEvent,
  summarizeWahaEvent,
  type NormalizedWahaMessage,
  type NormalizedWahaReaction,
  type WahaEventSummary,
} from "@/whatsapp/events";
import { fakeGroceryReceiptData } from "@/whatsapp/fake-extractor";
import { deleteTemporaryMedia, isSupportedGroceryImage, storeTemporaryMedia } from "@/whatsapp/media-store";
import {
  formatApproveConfirmationMessage,
  formatAsyncAcknowledgementMessage,
  formatGroceryProposalMessage,
  formatRejectConfirmationMessage,
} from "@/whatsapp/messages";
import { WahaClient } from "@/whatsapp/waha-client";
import { buildWahaWebSocketUrl } from "@/whatsapp/waha-events";

const log = logger.child({ module: "whatsapp-consumer" });

interface Config {
  port: number;
  chatId: string;
  session: string;
  defaultUserId: string | null;
  dataRoot: string;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function readConfig(): Config {
  return {
    port: Number(process.env.WHATSAPP_CONSUMER_PORT || 8788),
    chatId: requiredEnv("KAKEIBO_WHATSAPP_DEFAULT_CHAT_ID"),
    session: process.env.KAKEIBO_WHATSAPP_SESSION || "default",
    defaultUserId: process.env.KAKEIBO_WHATSAPP_DEFAULT_USER_ID || null,
    dataRoot: process.env.KAKEIBO_DATA_ROOT || "/app/data",
  };
}

const config = readConfig();
const wahaBaseUrl = requiredEnv("WAHA_BASE_URL");
const wahaApiKey = requiredEnv("WAHA_API_KEY");
const waha = new WahaClient(
  wahaBaseUrl,
  wahaApiKey,
  config.session
);
let resolvedDefaultUserId: string | null = null;

async function getDefaultUserId(): Promise<string> {
  if (config.defaultUserId) return config.defaultUserId;
  if (resolvedDefaultUserId) return resolvedDefaultUserId;

  const owner = await prisma.householdMember.findFirst({
    where: { role: "owner" },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  if (owner) {
    resolvedDefaultUserId = owner.userId;
    return resolvedDefaultUserId;
  }

  const user = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!user) {
    throw new Error("No Kakeibo user found for WhatsApp grocery import");
  }

  resolvedDefaultUserId = user.id;
  return resolvedDefaultUserId;
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return null;
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function isKakeiboTemplate(body: string): boolean {
  return body.trim().startsWith("🏦 *Kakeibo*");
}

async function handleHelp(message: NormalizedWahaMessage): Promise<void> {
  const outboundMessageId = await waha.sendText(message.chatId, getHelpMessage());
  log.info(
    {
      command: "/help",
      inboundMessageId: message.messageId,
      outboundMessageId,
    },
    "whatsapp help response sent"
  );
}

async function handleNewGrocery(message: NormalizedWahaMessage, note: string): Promise<void> {
  const command = getCommand("/new-grocery");
  if (!command) return;

  const run = await createCommandRun({
    command: command.name,
    mode: command.mode,
    chatId: message.chatId,
    inboundMessageId: message.messageId,
  });
  if (!run) return;
  if (run.status !== WhatsappCommandRunStatus.QUEUED || run.entityId) {
    return;
  }
  if (!(await claimQueuedCommandRun(run.id))) {
    return;
  }

  let ackId: string;
  try {
    ackId = await waha.sendText(message.chatId, formatAsyncAcknowledgementMessage());
  } catch (error) {
    await updateCommandRun(run.id, {
      status: WhatsappCommandRunStatus.FAILED,
      errorMessage: error instanceof Error ? error.message : "failed to send acknowledgement",
      completedAt: new Date(),
    });
    throw error;
  }

  await updateCommandRun(run.id, {
    outboundAckMessageId: ackId,
  });

  void processNewGrocery(run.id, message, note).catch(async (error) => {
    log.error({ error: serializeError(error), runId: run.id }, "new grocery processing failed");
    const failedRun = await prisma.whatsappCommandRun.findUnique({
      where: { id: run.id },
      select: { mediaPath: true },
    });
    await deleteTemporaryMedia(failedRun?.mediaPath, config.dataRoot);
    await updateCommandRun(run.id, {
      status: WhatsappCommandRunStatus.FAILED,
      mediaPath: null,
      errorMessage: error instanceof Error ? error.message : "unknown error",
      completedAt: new Date(),
    });
    await waha.sendText(
      message.chatId,
      [
        "🏦 *Kakeibo*",
        "⚠️ *Não consegui concluir*",
        "",
        "Tive um erro ao processar o cupom. Tente enviar novamente.",
      ].join("\n")
    );
  });
}

async function processNewGrocery(
  runId: number,
  message: NormalizedWahaMessage,
  _note: string
): Promise<void> {
  if (!message.media) {
    throw new Error("new-grocery requires one image attachment");
  }
  if (!isSupportedGroceryImage(message.media.mimetype)) {
    throw new Error(`unsupported grocery media type: ${message.media.mimetype}`);
  }

  const media = await waha.downloadMedia(message.media.url);
  const mediaPath = await storeTemporaryMedia({
    dataRoot: config.dataRoot,
    commandRunId: runId,
    buffer: media.buffer,
    mimetype: message.media.mimetype,
  });
  await updateCommandRun(runId, { mediaPath });

  const purchase = await createPurchaseFromReceiptData({
    userId: await getDefaultUserId(),
    receiptData: fakeGroceryReceiptData(),
    fallbackBoughtAt: new Date(),
  });

  const proposalId = await waha.sendText(
    message.chatId,
    formatGroceryProposalMessage({
      storeName: purchase.storeName,
      totalValue: purchase.totalValue,
      productCount: purchase.products.length,
      products: purchase.products.map((product) => ({
        description: product.description,
        totalValue: product.totalValue,
      })),
    })
  );

  await updateCommandRun(runId, {
    status: WhatsappCommandRunStatus.WAITING_REVIEW,
    outboundProposalMessageId: proposalId,
    entityType: "purchase",
    entityId: purchase.id,
  });
}

async function resolveRunFromReply(message: NormalizedWahaMessage) {
  if (!message.replyToMessageId) return null;
  return findCommandRunByProposalMessageId(message.replyToMessageId);
}

async function approveRun(runId: number): Promise<void> {
  const run = await prisma.whatsappCommandRun.findUnique({ where: { id: runId } });
  if (!run || isTerminalCommandRunStatus(run.status) || run.entityType !== "purchase" || !run.entityId) {
    return;
  }

  const purchase = await prisma.purchase.update({
    where: { id: run.entityId },
    data: { status: PurchaseStatus.APPROVED, updatedAt: new Date() },
  });
  await deleteTemporaryMedia(run.mediaPath, config.dataRoot);
  await updateCommandRun(run.id, {
    status: WhatsappCommandRunStatus.APPROVED,
    mediaPath: null,
    completedAt: new Date(),
  });
  await waha.sendText(run.chatId, formatApproveConfirmationMessage(purchase.storeName));
}

async function rejectRun(runId: number): Promise<void> {
  const run = await prisma.whatsappCommandRun.findUnique({ where: { id: runId } });
  if (!run || isTerminalCommandRunStatus(run.status) || run.entityType !== "purchase" || !run.entityId) {
    return;
  }

  const purchase = await prisma.purchase.findUnique({
    where: { id: run.entityId },
    select: { status: true },
  });
  if (purchase?.status === PurchaseStatus.NEEDS_REVIEW) {
    await prisma.product.deleteMany({ where: { purchaseId: run.entityId } });
    await prisma.purchase.delete({ where: { id: run.entityId } });
  }

  await deleteTemporaryMedia(run.mediaPath, config.dataRoot);
  await updateCommandRun(run.id, {
    status: WhatsappCommandRunStatus.REJECTED,
    mediaPath: null,
    completedAt: new Date(),
  });
  await waha.sendText(run.chatId, formatRejectConfirmationMessage());
}

async function handleApproveRejectReply(
  message: NormalizedWahaMessage,
  commandName: "/approve-grocery" | "/reject-grocery"
): Promise<void> {
  const run = await resolveRunFromReply(message);
  if (!run) {
    await waha.sendText(
      message.chatId,
      [
        "🏦 *Kakeibo*",
        "⚠️ *Não encontrei a compra*",
        "",
        "Responda diretamente a mensagem da compra importada.",
      ].join("\n")
    );
    return;
  }

  if (commandName === "/approve-grocery") {
    await approveRun(run.id);
  } else {
    await rejectRun(run.id);
  }
}

async function handleMessage(message: NormalizedWahaMessage): Promise<void> {
  if (message.source === "api" || isKakeiboTemplate(message.body)) {
    log.info(
      {
        messageId: message.messageId,
        source: message.source,
        fromMe: message.fromMe,
      },
      "whatsapp message ignored"
    );
    return;
  }

  const parsed = parseCommand(message.body);
  if (!parsed) {
    if (message.body.trim().startsWith("/")) {
      log.info(
        {
          messageId: message.messageId,
          source: message.source,
          fromMe: message.fromMe,
        },
        "unknown whatsapp command ignored"
      );
    }
    return;
  }

  const command = getCommand(parsed.name);
  log.info(
    {
      command: parsed.name,
      mode: command?.mode ?? "unknown",
      messageId: message.messageId,
      source: message.source,
      fromMe: message.fromMe,
      hasMedia: Boolean(message.media),
      isReply: Boolean(message.replyToMessageId),
    },
    "whatsapp command received"
  );

  switch (parsed.name) {
    case "/help":
      await handleHelp(message);
      return;
    case "/new-grocery":
      await handleNewGrocery(message, parsed.note);
      return;
    case "/approve-grocery":
      await handleApproveRejectReply(message, "/approve-grocery");
      return;
    case "/reject-grocery":
      await handleApproveRejectReply(message, "/reject-grocery");
      return;
  }
}

async function handleReaction(reaction: NormalizedWahaReaction): Promise<void> {
  if (reaction.source === "api") return;
  const run = await findCommandRunByProposalMessageId(reaction.targetMessageId);
  if (!run) return;

  if (reaction.emoji === "✅") {
    await approveRun(run.id);
  } else if (reaction.emoji === "❌") {
    await rejectRun(run.id);
  }
}

function shouldLogWebhookSummary(summary: WahaEventSummary): boolean {
  return summary.bodyKind === "command" || summary.eventName === "message.reaction";
}

async function handleEvent(event: unknown): Promise<void> {
  const summary = summarizeWahaEvent(event, {
    chatId: config.chatId,
    session: config.session,
  });
  const shouldLog = shouldLogWebhookSummary(summary);
  if (shouldLog) {
    log.info({ event: summary }, "whatsapp webhook event received");
  }

  const normalized = normalizeWahaEvent(event, {
    chatId: config.chatId,
    session: config.session,
  });
  if (!normalized) {
    if (shouldLog) {
      log.info({ event: summary }, "whatsapp webhook event ignored");
    }
    return;
  }

  if (normalized.type === "message") {
    await handleMessage(normalized);
  } else {
    await handleReaction(normalized);
  }
}

async function failStaleProcessingRuns(): Promise<void> {
  await prisma.whatsappCommandRun.updateMany({
    where: {
      status: WhatsappCommandRunStatus.PROCESSING,
      updatedAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
    },
    data: {
      status: WhatsappCommandRunStatus.FAILED,
      errorMessage: "Processamento interrompido antes da conclusão.",
      completedAt: new Date(),
    },
  });
}

await failStaleProcessingRuns();

function connectWahaWebSocket(): void {
  const url = buildWahaWebSocketUrl({
    baseUrl: wahaBaseUrl,
    apiKey: wahaApiKey,
    session: "*",
    events: ["message", "message.any", "message.reaction"],
  });
  const redactedUrl = buildWahaWebSocketUrl({
    baseUrl: wahaBaseUrl,
    apiKey: "***",
    session: "*",
    events: ["message", "message.any", "message.reaction"],
  });

  log.info({ url: redactedUrl }, "connecting to WAHA websocket");

  const socket = new WebSocket(url);

  socket.addEventListener("open", () => {
    log.info({ url: redactedUrl }, "WAHA websocket connected");
  });

  socket.addEventListener("message", (event) => {
    void (async () => {
      const payload = typeof event.data === "string" ? event.data : event.data.toString();
      await handleEvent(JSON.parse(payload));
    })().catch((error) => {
      log.error({ error: serializeError(error) }, "WAHA websocket event failed");
    });
  });

  socket.addEventListener("error", (event) => {
    log.error({ eventType: event.type }, "WAHA websocket error");
  });

  socket.addEventListener("close", (event) => {
    log.warn(
      { code: event.code, reason: event.reason, wasClean: event.wasClean },
      "WAHA websocket closed; reconnecting"
    );
    setTimeout(connectWahaWebSocket, 5000).unref();
  });
}

connectWahaWebSocket();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      json(res, 200, { ok: true, service: "whatsapp-consumer" });
      return;
    }

    if (req.method === "POST" && url.pathname === "/events") {
      const body = await readJsonBody(req);
      await handleEvent(body);
      json(res, 200, { ok: true });
      return;
    }

    json(res, 404, { ok: false, error: "not found" });
  } catch (error) {
    log.error({ error: serializeError(error) }, "request failed");
    json(res, 500, { ok: false, error: error instanceof Error ? error.message : "unknown error" });
  }
});

server.listen(config.port, "0.0.0.0", () => {
  log.info({ port: config.port }, "whatsapp-consumer listening");
});
