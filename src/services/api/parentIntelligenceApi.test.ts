import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  getParentOsChild,
  getParentOsHome,
  PARENT_OS_HOME_PATH,
  parentOsChildPath,
} from "./parentIntelligenceApi";
import { mockJsonResponse, stubFetch } from "@/test/test-utils";
import { emptyParentHome, FIRST_LEARNER } from "@/features/parent-os/parentIntelligence.fixtures";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function readApi(): string {
  return readFileSync(
    path.join(repoRoot, "src/services/api/parentIntelligenceApi.ts"),
    "utf8",
  );
}

describe("Parent Intelligence API adapter", () => {
  it("performs exactly GET /api/v1/parent-os/home", async () => {
    const calls = stubFetch(() => mockJsonResponse(emptyParentHome()));
    await getParentOsHome();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe("GET");
    expect(calls[0]?.url).toBe(PARENT_OS_HOME_PATH);
    expect(calls[0]?.url).not.toContain("?");
    expect(calls[0]?.body).toBeUndefined();
  });

  it("performs exactly GET /api/v1/parent-os/children/{id}", async () => {
    const calls = stubFetch(() => mockJsonResponse(emptyParentHome()));
    await getParentOsChild(FIRST_LEARNER);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe("GET");
    expect(calls[0]?.url).toBe(parentOsChildPath(FIRST_LEARNER));
    expect(calls[0]?.url).not.toContain("?");
    expect(calls[0]?.body).toBeUndefined();
  });

  it("is a generated-type GET adapter with no mutation or client authority", () => {
    const api = readApi();
    expect(api).toContain('from "./generated/aieos-v1"');
    expect(api).toContain('components["schemas"]["ParentIntelligenceResponse"]');
    expect(api).toContain('components["schemas"]["ParentChildCardResponse"]');
    expect(api).toContain('components["schemas"]["ParentAssignmentStatusResponse"]');
    expect(api).toContain('export async function getParentOsHome');
    expect(api).toContain('export async function getParentOsChild');
    expect(api).toContain('"/api/v1/parent-os/home"');
    expect(api).toContain("/api/v1/parent-os/children/");
    expect(api).toContain('method: "GET"');
    expect(api).not.toMatch(/method:\s*"(POST|PUT|PATCH|DELETE)"/);
    expect(api).not.toContain("body:");
    expect(api).not.toContain("query:");
    expect(api).not.toMatch(/capability|school scope|class scope|role/);
    expect(api).not.toContain("export async function post");
    expect(api).not.toContain("export async function put");
    expect(api).not.toContain("export async function patch");
    expect(api).not.toContain("export async function delete");
  });
});
