export function buildWahaWebSocketUrl(input: {
  baseUrl: string;
  apiKey: string;
  session: string;
  events: string[];
}): string {
  const url = new URL("/ws", input.baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("x-api-key", input.apiKey);
  url.searchParams.set("session", input.session);
  for (const event of input.events) {
    url.searchParams.append("events", event);
  }
  return url.toString();
}
