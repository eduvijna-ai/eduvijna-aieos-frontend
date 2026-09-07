import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getProviderAggregator,
  type CapabilityRouteResponse,
  type ProviderAggregatorResponse,
  type ProviderCandidateResponse,
} from "@/services/api/providerAggregatorApi";
import { useSession } from "@/services/session/useSession";
import { userMessageForApiError } from "@/shared/errors/ApiError";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { StatusBadge } from "@/shared/components/StatusBadge";
import "./providerAggregator.css";

type LoadStatus = "loading" | "ready" | "unavailable" | "error";

function runtimeModeLabel(mode: string): string {
  if (mode === "REAL") return "REAL AI";
  if (mode === "DEVELOPMENT_FAKE") return "DEVELOPMENT FAKE";
  return mode;
}

function configuredLabel(configured: boolean): string {
  return configured ? "Configured" : "Not configured";
}

function activeProvider(
  data: ProviderAggregatorResponse,
): ProviderCandidateResponse | undefined {
  return data.providers.find((item) => item.active);
}

function providerDisplayName(
  providers: ProviderCandidateResponse[],
  providerId: string,
): string {
  return (
    providers.find((item) => item.provider_id === providerId)?.display_name ??
    providerId
  );
}

export function ProviderAggregatorPage() {
  const { isConnected, isProduction } = useSession();
  const sessionReady = isConnected || isProduction;

  const [status, setStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [projection, setProjection] = useState<ProviderAggregatorResponse | null>(
    null,
  );

  const loadProjection = useCallback(async () => {
    if (!sessionReady) {
      setStatus("unavailable");
      return;
    }
    setStatus("loading");
    setErrorMessage(null);
    try {
      const response = await getProviderAggregator();
      setProjection(response.data);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setErrorMessage(userMessageForApiError(error));
    }
  }, [sessionReady]);

  useEffect(() => {
    void loadProjection();
  }, [loadProjection]);

  const current = useMemo(
    () => (projection ? activeProvider(projection) : undefined),
    [projection],
  );

  return (
    <article className="stack provider-aggregator-page">
      <header>
        <p className="muted">
          <Link to="/teacher-os/settings">Settings</Link>
          {" / "}
          AI development
        </p>
        <h1>Provider Aggregator</h1>
        <p className="muted">
          See which AI provider is powering this development environment.
        </p>
      </header>

      {status === "unavailable" ? (
        <EmptyState
          title="Connect a session"
          description="Provider Aggregator requires a connected DEV session (or production auth) before it can load."
        />
      ) : null}

      {status === "loading" ? (
        <LoadingState label="Loading provider runtime…" />
      ) : null}

      {status === "error" && errorMessage ? (
        <ErrorState
          title="Could not load provider runtime"
          message={errorMessage}
          onRetry={() => {
            void loadProjection();
          }}
        />
      ) : null}

      {status === "ready" && projection ? (
        <>
          <section
            className="panel provider-runtime"
            aria-labelledby="provider-runtime-heading"
          >
            <h2 id="provider-runtime-heading">Current runtime</h2>
            <p className="provider-runtime-mode">
              {runtimeModeLabel(projection.mode)}
            </p>
            <dl className="provider-runtime-facts">
              <div>
                <dt>Active provider</dt>
                <dd>{current?.display_name ?? projection.active_provider_id}</dd>
              </div>
              <div>
                <dt>Active model</dt>
                <dd>
                  <code>{projection.active_model_id}</code>
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusBadge
                    label={current?.active ? "Active" : "Inactive"}
                    kind={current?.active ? "approved" : "inactive"}
                  />
                </dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="provider-cards-heading">
            <h2 id="provider-cards-heading">Providers</h2>
            <ul className="provider-card-list">
              {projection.providers.map((provider) => (
                <ProviderCard key={provider.provider_id} provider={provider} />
              ))}
            </ul>
          </section>

          <CapabilityRouting
            routes={projection.capability_routes}
            providers={projection.providers}
          />
        </>
      ) : null}
    </article>
  );
}

function ProviderCard({ provider }: { provider: ProviderCandidateResponse }) {
  return (
    <li className="panel provider-card">
      <div className="provider-card-header">
        <h3>{provider.display_name}</h3>
        <StatusBadge
          label={provider.active ? "Active" : "Inactive"}
          kind={provider.active ? "approved" : "inactive"}
        />
      </div>
      <p className="muted">
        {configuredLabel(provider.configured)}
        {provider.development_only
          ? " · Available for automated/local deterministic testing"
          : null}
      </p>
      {provider.model_id ? (
        <p>
          Model: <code>{provider.model_id}</code>
        </p>
      ) : (
        <p className="muted">No model configured</p>
      )}
    </li>
  );
}

function CapabilityRouting({
  routes,
  providers,
}: {
  routes: CapabilityRouteResponse[];
  providers: ProviderCandidateResponse[];
}) {
  return (
    <section aria-labelledby="capability-routing-heading">
      <h2 id="capability-routing-heading">Capability Routing</h2>
      {routes.length === 0 ? (
        <EmptyState
          title="No capability routes"
          description="The backend did not report Model Gateway capability wiring for this runtime."
        />
      ) : (
        <table className="provider-routing-table">
          <caption className="sr-only">
            Current Model Gateway capability routing
          </caption>
          <thead>
            <tr>
              <th scope="col">Capability</th>
              <th scope="col">Provider</th>
              <th scope="col">Model</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((route) => (
              <tr key={route.capability_id}>
                <th scope="row">{route.display_name}</th>
                <td>{providerDisplayName(providers, route.provider_id)}</td>
                <td>
                  <code>{route.model_id}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
