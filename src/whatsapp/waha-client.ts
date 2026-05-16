export interface SendTextResponse {
  id?: string;
  _data?: {
    id?: {
      _serialized?: string;
    };
  };
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
