const RUNNER_SMOKE_EXPECTED_TEXT = "KAKEIBO_CODEX_SMOKE_OK";

type FetchImpl = typeof fetch;

type RunnerStage = "config" | "version" | "login-status" | "smoke" | "complete";

type JsonRecord = Record<string, unknown>;

export type RunnerEndpointResult = {
  ok: boolean;
  httpStatus: number;
  error?: string;
  version?: string;
  expectedVersion?: string;
  expectedVersionMatched?: boolean;
  exitCode?: number;
  expectedTextMatched?: boolean;
  usageCaptured?: boolean;
  lastMessage?: string | null;
  usage?: unknown;
};

export type CodexRunnerImageSmokeResult = {
  ok: boolean;
  stage: RunnerStage;
  version: RunnerEndpointResult;
  loginStatus: RunnerEndpointResult;
  smoke: RunnerEndpointResult;
};

export type CodexRunnerImageSmokeOptions = {
  baseUrl?: string;
  token?: string;
  expectedVersion?: string;
  fetchImpl?: FetchImpl;
};

const notRun: RunnerEndpointResult = {
  ok: false,
  httpStatus: 0,
  error: "not run",
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" ? value : undefined;
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function endpointResult(response: Response, body: unknown): RunnerEndpointResult {
  if (!isRecord(body)) {
    return {
      ok: false,
      httpStatus: response.status,
      error: "Runner returned a non-object JSON response.",
    };
  }

  return {
    ok: response.ok && body.ok === true,
    httpStatus: response.status,
    error: stringValue(body.error),
    version: stringValue(body.version),
    exitCode: numberValue(body.exitCode),
    expectedTextMatched: booleanValue(body.expectedTextMatched),
    usageCaptured: booleanValue(body.usageCaptured),
    lastMessage:
      typeof body.lastMessage === "string" || body.lastMessage === null
        ? body.lastMessage
        : undefined,
    usage: body.usage,
  };
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: "Runner returned invalid JSON." };
  }
}

async function requestRunner(
  fetchImpl: FetchImpl,
  baseUrl: string,
  token: string,
  path: string,
  method: "GET" | "POST"
): Promise<RunnerEndpointResult> {
  try {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    return endpointResult(response, await readJson(response));
  } catch (error) {
    return {
      ok: false,
      httpStatus: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runCodexRunnerImageSmoke({
  baseUrl = process.env.CODEX_RUNNER_BASE_URL,
  token = process.env.CODEX_RUNNER_TOKEN,
  expectedVersion = process.env.CODEX_RUNNER_EXPECTED_VERSION || "0.130.0",
  fetchImpl = fetch,
}: CodexRunnerImageSmokeOptions = {}): Promise<CodexRunnerImageSmokeResult> {
  if (!baseUrl || !token) {
    return {
      ok: false,
      stage: "config",
      version: notRun,
      loginStatus: notRun,
      smoke: notRun,
    };
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const version = await requestRunner(fetchImpl, normalizedBaseUrl, token, "/codex/version", "GET");
  version.expectedVersion = expectedVersion;
  version.expectedVersionMatched =
    typeof version.version === "string" && version.version.includes(expectedVersion);

  if (!version.ok || !version.expectedVersionMatched) {
    return {
      ok: false,
      stage: "version",
      version,
      loginStatus: notRun,
      smoke: notRun,
    };
  }

  const loginStatus = await requestRunner(
    fetchImpl,
    normalizedBaseUrl,
    token,
    "/codex/login/status",
    "GET"
  );
  if (!loginStatus.ok) {
    return {
      ok: false,
      stage: "login-status",
      version,
      loginStatus,
      smoke: notRun,
    };
  }

  const smoke = await requestRunner(fetchImpl, normalizedBaseUrl, token, "/codex/smoke", "POST");
  const smokeOk =
    smoke.ok &&
    smoke.expectedTextMatched === true &&
    smoke.usageCaptured === true &&
    typeof smoke.lastMessage === "string" &&
    smoke.lastMessage.trim() === RUNNER_SMOKE_EXPECTED_TEXT;

  return {
    ok: smokeOk,
    stage: smokeOk ? "complete" : "smoke",
    version,
    loginStatus,
    smoke,
  };
}
