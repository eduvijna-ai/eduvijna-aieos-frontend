import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("TOS-DEV10-I04 Assistant architecture", () => {
  it("frontend assistant modules never call providers directly", () => {
    const page = read("src/features/teacher-os/ai-assistant/AiAssistantPage.tsx");
    const api = read("src/services/api/aiAssistantApi.ts");
    expect(page.toLowerCase()).not.toContain("openai");
    expect(api.toLowerCase()).not.toContain("openai");
    expect(api).toContain("/api/v1/teacher-os/assistant");
    expect(page).toContain("respondTeacherOsAssistant");
  });

  it("router no longer mounts PlaceholderPage for ai-assistant", () => {
    const router = read("src/app/router.tsx");
    expect(router).toContain("AiAssistantPage");
    expect(router).not.toMatch(
      /ai-assistant[\s\S]*PlaceholderPage title="AI Assistant"/,
    );
  });

  it("pins Backend I04 OpenAPI digest", () => {
    const sync = read("scripts/sync-openapi-snapshot.mjs");
    expect(sync).toContain("a6a1cbb5a83fc9feec6a6f5077fcc5e60f60ab24");
    const digest = createHash("sha256")
      .update(
        readFileSync(
          path.join(repoRoot, "contracts/openapi/aieos-v1.consumer-snapshot.json"),
        ),
      )
      .digest("hex")
      .toUpperCase();
    expect(digest).toBe(
      "4BF6C88B662D99F1E0E21E6F0AF2D267B39644300D85D99A859A7720F1568411",
    );
  });
});
