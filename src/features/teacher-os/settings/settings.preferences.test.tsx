import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  mockJsonResponse,
  mockProblemResponse,
  renderApp,
  stubFetch,
} from "@/test/test-utils";
import { DEFAULT_TEACHER_MEMORY_PREFERENCES } from "./preferences";

const MEMORY_ID = "aaaaaaaa-aaaa-7aaa-aaaa-aaaaaaaaaaaa";

function sampleMemory(overrides?: Record<string, unknown>) {
  return {
    memory_id: MEMORY_ID,
    schema_version: 1,
    preferences: { ...DEFAULT_TEACHER_MEMORY_PREFERENCES },
    aggregate_revision: 0,
    created_at: "2026-09-06T10:00:00Z",
    updated_at: "2026-09-06T10:00:00Z",
    ...overrides,
  };
}

describe("TOS-DEV10-I03 Settings teaching preferences", () => {
  it("loads defaults on 404 and shows not-saved guidance", async () => {
    stubFetch((call) => {
      if (call.url.includes("/api/v1/teacher-os/memory")) {
        return mockJsonResponse({ title: "Not found", status: 404 }, { status: 404 });
      }
      return mockJsonResponse({ title: "x", status: 404 }, { status: 404 });
    });

    renderApp("/teacher-os/settings");

    expect(
      await screen.findByRole("heading", { name: "Teaching preferences" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Not saved yet/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Teaching style" })).toHaveValue(
      "balanced",
    );
    expect(
      screen.getByRole("combobox", { name: "Preferred difficulty" }),
    ).toHaveValue("standard");
    expect(
      screen.getByRole("combobox", { name: "Preparation detail" }),
    ).toHaveValue("balanced");
    expect(screen.getByRole("combobox", { name: "Output format" })).toHaveValue(
      "structured",
    );
    expect(
      screen.getByRole("checkbox", { name: /Include differentiation/i }),
    ).not.toBeChecked();
    expect(screen.queryByText(/memory_id/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/aggregate_revision/i)).not.toBeInTheDocument();
  });

  it("saves create preferences and confirms success", async () => {
    const user = userEvent.setup();
    const calls = stubFetch((call) => {
      if (call.method === "GET" && call.url.includes("/teacher-os/memory")) {
        return mockJsonResponse({ title: "Not found", status: 404 }, { status: 404 });
      }
      if (call.method === "POST" && call.url.includes("/teacher-os/memory")) {
        return mockJsonResponse(
          sampleMemory({
            preferences: {
              teaching_style: "inquiry_led",
              preferred_difficulty: "challenging",
              preparation_detail: "detailed",
              output_format: "print_friendly",
              include_differentiation: true,
            },
            aggregate_revision: 0,
          }),
          { status: 201, etag: '"0"' },
        );
      }
      return mockJsonResponse({ title: "x", status: 404 }, { status: 404 });
    });

    renderApp("/teacher-os/settings");
    await screen.findByRole("heading", { name: "Teaching preferences" });

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Teaching style" }),
      "inquiry_led",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Preferred difficulty" }),
      "challenging",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Preparation detail" }),
      "detailed",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Output format" }),
      "print_friendly",
    );
    await user.click(
      screen.getByRole("checkbox", { name: /Include differentiation/i }),
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("Teaching preferences saved."),
    ).toBeInTheDocument();
    expect(screen.getByText(/saved for your teacher profile/i)).toBeInTheDocument();

    const post = calls.find(
      (call) => call.method === "POST" && call.url.includes("/teacher-os/memory"),
    );
    expect(post).toBeTruthy();
    expect(post?.headers.get("Idempotency-Key")).toBeTruthy();
    expect(post?.body).toEqual({
      preferences: {
        teaching_style: "inquiry_led",
        preferred_difficulty: "challenging",
        preparation_detail: "detailed",
        output_format: "print_friendly",
        include_differentiation: true,
      },
    });
  });

  it("resets the form to defaults without auto-saving", async () => {
    const user = userEvent.setup();
    const calls = stubFetch((call) => {
      if (call.method === "GET" && call.url.includes("/teacher-os/memory")) {
        return mockJsonResponse(
          sampleMemory({
            preferences: {
              teaching_style: "collaborative",
              preferred_difficulty: "supportive",
              preparation_detail: "concise",
              output_format: "print_friendly",
              include_differentiation: true,
            },
            aggregate_revision: 2,
          }),
          { etag: '"2"' },
        );
      }
      return mockJsonResponse({ title: "x", status: 404 }, { status: 404 });
    });

    renderApp("/teacher-os/settings");
    await screen.findByRole("combobox", { name: "Teaching style" });
    expect(screen.getByRole("combobox", { name: "Teaching style" })).toHaveValue(
      "collaborative",
    );

    await user.click(screen.getByRole("button", { name: "Reset to defaults" }));
    expect(screen.getByRole("combobox", { name: "Teaching style" })).toHaveValue(
      "balanced",
    );
    expect(
      screen.getByRole("combobox", { name: "Preferred difficulty" }),
    ).toHaveValue("standard");
    expect(
      screen.getByText(/Form reset to defaults\. Save deliberately/i),
    ).toBeInTheDocument();
    expect(
      calls.filter(
        (call) =>
          call.method === "POST" ||
          call.method === "PUT" ||
          call.method === "PATCH",
      ),
    ).toHaveLength(0);
  });

  it("handles stale ETag conflict by refreshing without auto-resubmit", async () => {
    const user = userEvent.setup();
    let getCount = 0;
    let putCount = 0;
    stubFetch((call) => {
      if (call.method === "GET" && call.url.includes("/teacher-os/memory")) {
        getCount += 1;
        if (getCount === 1) {
          return mockJsonResponse(
            sampleMemory({
              preferences: {
                ...DEFAULT_TEACHER_MEMORY_PREFERENCES,
                teaching_style: "balanced",
              },
              aggregate_revision: 1,
            }),
            { etag: '"1"' },
          );
        }
        return mockJsonResponse(
          sampleMemory({
            preferences: {
              ...DEFAULT_TEACHER_MEMORY_PREFERENCES,
              teaching_style: "direct_instruction",
            },
            aggregate_revision: 2,
          }),
          { etag: '"2"' },
        );
      }
      if (call.method === "PUT" && call.url.includes("/teacher-os/memory")) {
        putCount += 1;
        return mockProblemResponse(412, "resource_revision_conflict");
      }
      return mockJsonResponse({ title: "x", status: 404 }, { status: 404 });
    });

    renderApp("/teacher-os/settings");
    await screen.findByRole("combobox", { name: "Teaching style" });
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Teaching style" }),
      "inquiry_led",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText(/changed on the server since you loaded them/i),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: "Teaching style" }),
      ).toHaveValue("direct_instruction");
    });
    expect(putCount).toBe(1);
    expect(getCount).toBe(2);
  });

  it("does not expose a Teacher Memory primary nav item", async () => {
    stubFetch((call) => {
      if (call.url.includes("/teacher-os/memory")) {
        return mockJsonResponse({ title: "Not found", status: 404 }, { status: 404 });
      }
      return mockJsonResponse({ title: "x", status: 404 }, { status: 404 });
    });

    renderApp("/teacher-os/settings");
    await screen.findByRole("heading", { name: "Settings" });

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByRole("link", { name: "Settings" })).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: /memory/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Teacher Memory/i })).not.toBeInTheDocument();
  });
});
