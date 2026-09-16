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

  it("pins Backend I05-F1 OpenAPI digest", () => {
    const sync = read("scripts/sync-openapi-snapshot.mjs");
    expect(sync).toContain("3d25bb2d7ae3a6a95affdf075a75f20db48a6959");
    const digest = createHash("sha256")
      .update(
        readFileSync(
          path.join(repoRoot, "contracts/openapi/aieos-v1.consumer-snapshot.json"),
        ),
      )
      .digest("hex")
      .toUpperCase();
    expect(digest).toBe(
      "BE60CC2A4612F77AB333088D264B9501B9AB842995AEC1539DA89EA0E8462B47",
    );
  });
});
