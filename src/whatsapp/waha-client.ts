export interface SendTextResponse {
  id?: string;
  _data?: {
    id?: {
      _serialized?: string;
    };
  };
}

export interface WahaSession {
  name: string;
  status: string;
  me?: unknown;
  presence?: unknown;
  engine?: unknown;
}

interface EnsureSessionStartedOptions {
  timeoutMs?: number;
  intervalMs?: number;
}

export class WahaClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly session: string
  ) {}

  private headers(extra?: HeadersInit): HeadersInit {
    return {
      "X-Api-Key": this.apiKey,
      ...extra,
    };
  }

  private async jsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: this.headers(init?.headers),
    });

    if (!response.ok) {
      throw new Error(`WAHA request failed: ${response.status} ${await response.text()}`);
    }

    return response.json() as Promise<T>;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getSession(): Promise<WahaSession> {
    return this.jsonRequest<WahaSession>(`/api/sessions/${encodeURIComponent(this.session)}`);
  }

  async startSession(): Promise<WahaSession> {
    return this.jsonRequest<WahaSession>(`/api/sessions/${encodeURIComponent(this.session)}/start`, {
      method: "POST",
    });
  }

  async ensureSessionStarted(options: EnsureSessionStartedOptions = {}): Promise<WahaSession> {
    const timeoutMs = options.timeoutMs ?? 60_000;
    const intervalMs = options.intervalMs ?? 2_000;
    const deadline = Date.now() + timeoutMs;
    let session = await this.getSession();

    if (session.status !== "WORKING") {
      session = await this.startSession();
    }

    while (session.status !== "WORKING" && Date.now() < deadline) {
      await this.sleep(intervalMs);
      session = await this.getSession();
    }

    if (session.status !== "WORKING") {
      throw new Error(`WAHA session ${this.session} did not reach WORKING status; current status is ${session.status}`);
    }

    return session;
  }

  async sendText(chatId: string, text: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/sendText`, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ session: this.session, chatId, text }),
    });

    if (!response.ok) {
      throw new Error(`WAHA sendText failed: ${response.status} ${await response.text()}`);
    }

    const body = (await response.json()) as SendTextResponse;
    const messageId = body._data?.id?._serialized ?? body.id;
    if (!messageId) {
      throw new Error("WAHA sendText response did not include a message id");
    }

    return messageId;
  }

  async downloadMedia(url: string): Promise<{ buffer: Buffer; contentType: string | null }> {
    const resolvedUrl = url.startsWith("http")
      ? url
      : `${this.baseUrl.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
    const response = await fetch(resolvedUrl, {
      headers: this.headers(),
    });

    if (!response.ok) {
      throw new Error(`WAHA media download failed: ${response.status} ${await response.text()}`);
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type"),
    };
  }

}
