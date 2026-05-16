export interface WahaMedia {
  url: string;
  mimetype: string;
  filename?: string | null;
}

export interface NormalizedWahaMessage {
  type: "message";
  messageId: string;
  chatId: string;
  session: string;
  body: string;
  fromMe: boolean;
  source: string | null;
  replyToMessageId: string | null;
  media: WahaMedia | null;
}

export interface NormalizedWahaReaction {
  type: "reaction";
  messageId: string;
  chatId: string;
  session: string;
  emoji: string;
  targetMessageId: string;
  source: string | null;
}

export type NormalizedWahaEvent = NormalizedWahaMessage | NormalizedWahaReaction;

interface NormalizeConfig {
  chatId: string;
  session: string;
}

function serializedId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "_serialized" in value) {
    const serialized = (value as { _serialized?: unknown })._serialized;
    return typeof serialized === "string" ? serialized : null;
  }
  return null;
}

function inferChatId(payload: Record<string, unknown>): string | null {
  const from = serializedId(payload.from);
  const to = serializedId(payload.to);
  const id = payload.id;

  if (from?.endsWith("@g.us")) return from;
  if (to?.endsWith("@g.us")) return to;

  if (typeof id === "string") {
    const match = id.match(/(?:true|false)_([^_]+@g\.us)_/);
    if (match) return match[1];
  }

  return null;
}

function normalizeMedia(media: unknown): WahaMedia | null {
  if (!media || typeof media !== "object") return null;
  const raw = media as Record<string, unknown>;
  if (typeof raw.url !== "string" || typeof raw.mimetype !== "string") return null;
  return {
    url: raw.url,
    mimetype: raw.mimetype,
    filename: typeof raw.filename === "string" ? raw.filename : null,
  };
}

function normalizeReplyToMessageId(payload: Record<string, unknown>): string | null {
  const replyTo = payload.replyTo;
  if (!replyTo || typeof replyTo !== "object") return null;
  const raw = replyTo as Record<string, unknown>;
  return serializedId(raw.id);
}

export function normalizeWahaEvent(
  event: unknown,
  config: NormalizeConfig
): NormalizedWahaEvent | null {
  if (!event || typeof event !== "object") return null;
  const rawEvent = event as Record<string, unknown>;
  const payload = rawEvent.payload;
  if (!payload || typeof payload !== "object") return null;

  const eventName = rawEvent.event;
  const session = typeof rawEvent.session === "string" ? rawEvent.session : config.session;
  if (session !== config.session) return null;

  const rawPayload = payload as Record<string, unknown>;
  const chatId = inferChatId(rawPayload);
  if (chatId !== config.chatId) return null;

  const source = typeof rawPayload.source === "string" ? rawPayload.source : null;

  if (eventName === "message.any" || eventName === "message") {
    const messageId = serializedId(rawPayload.id);
    if (!messageId) return null;
    return {
      type: "message",
      messageId,
      chatId,
      session,
      body: typeof rawPayload.body === "string" ? rawPayload.body : "",
      fromMe: rawPayload.fromMe === true,
      source,
      replyToMessageId: normalizeReplyToMessageId(rawPayload),
      media: normalizeMedia(rawPayload.media),
    };
  }

  if (eventName === "message.reaction") {
    const reaction = rawPayload.reaction;
    if (!reaction || typeof reaction !== "object") return null;
    const rawReaction = reaction as Record<string, unknown>;
    const messageId = serializedId(rawPayload.id) || `reaction:${Date.now()}`;
    const emoji = typeof rawReaction.text === "string" ? rawReaction.text : "";
    const targetMessageId = serializedId(rawReaction.messageId);
    if (!emoji || !targetMessageId) return null;

    return {
      type: "reaction",
      messageId,
      chatId,
      session,
      emoji,
      targetMessageId,
      source,
    };
  }

  return null;
}
