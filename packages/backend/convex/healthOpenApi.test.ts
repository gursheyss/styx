import { describe, expect, test } from "bun:test";

import { buildHealthOpenApiDocument } from "./healthOpenApi";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

describe("buildHealthOpenApiDocument", () => {
  test("includes summary, query, write-intent and openapi endpoints", () => {
    const document = buildHealthOpenApiDocument("https://api.example.com");
    expect(document.openapi).toBe("3.1.0");

    const paths = document.paths;
    expect(isRecord(paths)).toBe(true);
    if (!isRecord(paths)) {
      return;
    }

    expect(paths["/health/ingest"] === undefined).toBe(false);
    expect(paths["/health/query"] === undefined).toBe(false);
    expect(paths["/health/write-intents"] === undefined).toBe(false);
    expect(paths["/health/openapi.json"] === undefined).toBe(false);

    const components = document.components;
    expect(isRecord(components)).toBe(true);
    if (!isRecord(components)) {
      return;
    }

    const securitySchemes = components.securitySchemes;
    expect(isRecord(securitySchemes)).toBe(true);
    if (!isRecord(securitySchemes)) {
      return;
    }
    expect(securitySchemes.bearerAuth === undefined).toBe(false);

    const schemas = components.schemas;
    expect(isRecord(schemas)).toBe(true);
    if (!isRecord(schemas)) {
      return;
    }
    expect(schemas.HealthStructuredQueryRequest === undefined).toBe(false);
  });
});
