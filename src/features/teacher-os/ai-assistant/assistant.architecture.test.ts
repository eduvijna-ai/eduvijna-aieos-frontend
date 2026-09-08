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
    expect(sync).toContain("921d35eb08890a4e1d86cf95daf9d38cdfc4a13c");
    const digest = createHash("sha256")
      .update(
        readFileSync(
          path.join(repoRoot, "contracts/openapi/aieos-v1.consumer-snapshot.json"),
        ),
      )
      .digest("hex")
      .toUpperCase();
    expect(digest).toBe(
      "4691D6BADA2157D436435BB5CCDD6797EA670D1A87543D42CA39A478F940F330",
    );
  });
});
