export type ValidationResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

const JSON_HEADERS = {
  "content-type": "application/json",
};

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isIntegerNumber(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value);
}

export function parseIntegerQueryParam(
  value: string | null,
  name: string,
  options?: { min?: number; max?: number },
): ValidationResult<number> {
  if (value === null) {
    return {
      ok: false,
      error: `${name} is required`,
      status: 400,
    };
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return {
      ok: false,
      error: `${name} must be an integer`,
      status: 400,
    };
  }

  const min = options?.min;
  if (min !== undefined && parsed < min) {
    return {
      ok: false,
      error: `${name} must be >= ${min}`,
      status: 400,
    };
  }

  const max = options?.max;
  if (max !== undefined && parsed > max) {
    return {
      ok: false,
      error: `${name} must be <= ${max}`,
      status: 400,
    };
  }

  return {
    ok: true,
    value: parsed,
  };
}

export function parseDayKey(rawValue: string | null): ValidationResult<string> {
  if (rawValue === null) {
    return {
      ok: false,
      error: "day key is required",
      status: 400,
    };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    return {
      ok: false,
      error: "Invalid day key format. Expected YYYY-MM-DD",
      status: 400,
    };
  }

  return {
    ok: true,
    value: rawValue,
  };
}

function secureTokenMatches(expected: string, actual: string): boolean {
  if (expected.length !== actual.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ actual.charCodeAt(index);
  }

  return mismatch === 0;
}

export function requireBearerToken(
  request: Request,
  getExpectedBearerToken: () => string | undefined,
): ValidationResult<void> {
  const configuredToken = getExpectedBearerToken();
  if (!isNonEmptyString(configuredToken)) {
    return {
      ok: false,
      error: "PRIVATE_API_BEARER_TOKEN is not configured",
      status: 500,
    };
  }

  const authHeader = request.headers.get("Authorization");
  if (!isNonEmptyString(authHeader)) {
    return {
      ok: false,
      error: "Missing Authorization header",
      status: 401,
    };
  }

  const bearerPrefix = "Bearer ";
  if (!authHeader.startsWith(bearerPrefix)) {
    return {
      ok: false,
      error: "Authorization header must use Bearer token",
      status: 401,
    };
  }

  const token = authHeader.slice(bearerPrefix.length).trim();
  if (!isNonEmptyString(token)) {
    return {
      ok: false,
      error: "Bearer token is required",
      status: 401,
    };
  }

  if (!secureTokenMatches(configuredToken, token)) {
    return {
      ok: false,
      error: "Invalid bearer token",
      status: 403,
    };
  }

  return {
    ok: true,
    value: undefined,
  };
}
