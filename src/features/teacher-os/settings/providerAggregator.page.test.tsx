import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ProviderAggregatorResponse } from "@/services/api/providerAggregatorApi";
import {
  mockJsonResponse,
  mockProblemResponse,
  renderApp,
  stubFetch,
} from "@/test/test-utils";

function groqActiveProjection(
  overrides?: Partial<ProviderAggregatorResponse>,
): ProviderAggregatorResponse {
  return {
    active_provider_id: "groq",
    active_model_id: "openai/gpt-oss-120b",
    mode: "REAL",
    providers: [
      {
        provider_id: "groq",
        display_name: "Groq",
        configured: true,
        active: true,
        model_id: "openai/gpt-oss-120b",
        development_only: false,
      },
      {
        provider_id: "openai",
        display_name: "OpenAI",
        configured: false,
        active: false,
        model_id: null,
        development_only: false,
      },
      {
        provider_id: "fake",
        display_name: "Development Fake",
        configured: true,
        active: false,
        model_id: "fake-model",
        development_only: true,
      },
    ],
    capability_routes: [
      {
        capability_id: "education.generate_preparation_kit",
        display_name: "Preparation Kit",
        provider_id: "groq",
        model_id: "openai/gpt-oss-120b",
      },
      {
        capability_id: "teacher_os.assistant_respond",
        display_name: "AI Assistant",
        provider_id: "groq",
        model_id: "openai/gpt-oss-120b",
      },
      {
        capability_id: "education.generate_worksheet",
        display_name: "Worksheet Generation",
        provider_id: "groq",
        model_id: "openai/gpt-oss-120b",
      },
    ],
    ...overrides,
  };
}

function fakeProjection(): ProviderAggregatorResponse {
  return groqActiveProjection({
    active_provider_id: "fake",
    active_model_id: "fake-model",
    mode: "DEVELOPMENT_FAKE",
    providers: [
      {
        provider_id: "groq",
        display_name: "Groq",
        configured: false,
        active: false,
        model_id: null,
        development_only: false,
      },
      {
        provider_id: "openai",
        display_name: "OpenAI",
        configured: false,
        active: false,
        model_id: null,
        development_only: false,
      },
      {
        provider_id: "fake",
        display_name: "Development Fake",
        configured: true,
        active: true,
        model_id: "fake-model",
        development_only: true,
      },
    ],
    capability_routes: [
      {
        capability_id: "education.generate_preparation_kit",
        display_name: "Preparation Kit",
        provider_id: "fake",
        model_id: "fake-model",
      },
    ],
  });
}

describe("TOS-CX01-I03 Provider Aggregator", () => {
  it("renders Groq REAL AI runtime from the backend projection", async () => {
    stubFetch((call) => {
      if (call.url.includes("/api/v1/platform/ai/providers")) {
        return mockJsonResponse(groqActiveProjection());
      }
      return mockJsonResponse({ title: "x", status: 404 }, { status: 404 });
    });

    renderApp("/teacher-os/settings/provider-aggregator");

    expect(
      await screen.findByRole("heading", { name: "Provider Aggregator" }),
    ).toBeInTheDocument();
    expect(screen.getByText("REAL AI")).toBeInTheDocument();
    expect(screen.getAllByText("Groq").length).toBeGreaterThan(0);
    expect(screen.getAllByText("openai/gpt-oss-120b").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "OpenAI" })).toBeInTheDocument();
    expect(screen.getByText("Not configured")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Development Fake" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/automated\/local deterministic testing/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Capability Routing" }),
    ).toBeInTheDocument();
    const routing = screen.getByRole("table");
    expect(within(routing).getByText("Preparation Kit")).toBeInTheDocument();
    expect(within(routing).getByText("AI Assistant")).toBeInTheDocument();
    expect(within(routing).getByText("Worksheet Generation")).toBeInTheDocument();
    expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: /api key/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /save provider/i }),
    ).not.toBeInTheDocument();
  });

  it("renders fake mode and backend-provided capability routing", async () => {
    stubFetch((call) => {
      if (call.url.includes("/api/v1/platform/ai/providers")) {
        return mockJsonResponse(fakeProjection());
      }
      return mockJsonResponse({ title: "x", status: 404 }, { status: 404 });
    });

    renderApp("/teacher-os/settings/provider-aggregator");
    expect(await screen.findByText("DEVELOPMENT FAKE")).toBeInTheDocument();
    expect(screen.getByText("Preparation Kit")).toBeInTheDocument();
    expect(screen.queryByText("Worksheet Generation")).not.toBeInTheDocument();
    expect(screen.getAllByText("fake-model").length).toBeGreaterThan(0);
  });

  it("shows loading then error states", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    stubFetch((call) => {
      if (call.url.includes("/api/v1/platform/ai/providers")) {
        return new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        });
      }
      return mockJsonResponse({ title: "x", status: 404 }, { status: 404 });
    });

    renderApp("/teacher-os/settings/provider-aggregator");
    expect(screen.getByText("Loading provider runtime…")).toBeInTheDocument();
    resolveFetch?.(mockProblemResponse(503, "service_unavailable"));
    expect(
      await screen.findByRole("heading", {
        name: "Could not load provider runtime",
      }),
    ).toBeInTheDocument();
  });

  it("shows connect-session empty state when disconnected", async () => {
    stubFetch(() => mockJsonResponse({ title: "x", status: 404 }, { status: 404 }));
    renderApp("/teacher-os/settings/provider-aggregator", null);
    expect(
      await screen.findByRole("heading", { name: "Connect a session" }),
    ).toBeInTheDocument();
  });

  it("does not add Provider Aggregator to primary Teacher navigation", async () => {
    stubFetch((call) => {
      if (call.url.includes("/api/v1/platform/ai/providers")) {
        return mockJsonResponse(groqActiveProjection());
      }
      if (call.url.includes("/teacher-os/memory")) {
        return mockJsonResponse({ title: "Not found", status: 404 }, { status: 404 });
      }
      return mockJsonResponse({ title: "x", status: 404 }, { status: 404 });
    });

    renderApp("/teacher-os/settings/provider-aggregator");
    await screen.findByRole("heading", { name: "Provider Aggregator" });
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(
      within(nav).queryByRole("link", { name: "Provider Aggregator" }),
    ).not.toBeInTheDocument();
    for (const label of [
      "Today",
      "Prepare",
      "Teach",
      "Assess",
      "Improve",
      "Library",
      "AI Assistant",
      "Settings",
    ]) {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    }
  });
});

describe("TOS-CX01-I03 Settings DEV entry", () => {
  it("links to Provider Aggregator from Settings in DEV", async () => {
    const user = userEvent.setup();
    stubFetch((call) => {
      if (call.url.includes("/teacher-os/memory")) {
        return mockJsonResponse({ title: "Not found", status: 404 }, { status: 404 });
      }
      if (call.url.includes("/api/v1/platform/ai/providers")) {
        return mockJsonResponse(groqActiveProjection());
      }
      return mockJsonResponse({ title: "x", status: 404 }, { status: 404 });
    });

    renderApp("/teacher-os/settings");
    expect(
      await screen.findByRole("heading", { name: "AI development" }),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Provider Aggregator" });
    expect(link).toHaveAttribute(
      "href",
      "/teacher-os/settings/provider-aggregator",
    );
    await user.click(link);
    expect(
      await screen.findByRole("heading", { name: "Provider Aggregator" }),
    ).toBeInTheDocument();
    expect(screen.getByText("REAL AI")).toBeInTheDocument();
  });
});
