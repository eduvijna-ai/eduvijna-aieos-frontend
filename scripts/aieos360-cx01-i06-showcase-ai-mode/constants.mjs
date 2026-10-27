/** AIEOS360-CX01-I06 showcase AI mode governance (NON_PRODUCTION). */

export const SHOWCASE_MODE_ENV = "AIEOS360_CX01_I06_SHOWCASE_MODE";

export const MODE_DETERMINISTIC = "DETERMINISTIC";
export const MODE_REAL_AI = "REAL_AI";

export const SUPPORTED_SHOWCASE_MODES = new Set([
  MODE_DETERMINISTIC,
  MODE_REAL_AI,
]);

export const REAL_AI_PROVIDERS = new Set(["groq", "openai"]);

export const PROVIDER_SECRET_ENV_KEYS = [
  "AIEOS_GROQ_API_KEY",
  "AIEOS_OPENAI_API_KEY",
  "OPENAI_API_KEY",
  "GROQ_API_KEY",
  "AZURE_OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
];

export const PROVIDER_CONFIG_ENV_KEYS = [
  "AIEOS_AI_PROVIDER",
  "AIEOS_AI_MODEL",
  "AIEOS_AI_MAX_OUTPUT_TOKENS",
  "AIEOS_AI_TIMEOUT_SECONDS",
  "AIEOS_GENERATION_LEASE_SECONDS",
];

export const GOVERNED_SOURCE_REFS = {
  architecture: {
    repo: "eduvijna-ai/eduvijna-architecture",
    sha: "491295c3cf0a151f31686a6a2e1a2176cd92c782",
  },
  product: {
    repo: "eduvijna-ai/eduvijna-product",
    sha: "b4b3048fb7a6a1c50ae8619dc490743714f2e3e2",
  },
  backend: {
    repo: "eduvijna-ai/eduvijna-aieos-backend",
    sha: "637583f42b7c475ef83f6f99bca7e65e665a253d",
  },
  frontend: {
    repo: "eduvijna-ai/eduvijna-aieos-frontend",
    sha: "8c8247afda0b9a34e688d2c300d46e83526bb126",
  },
  infrastructure: {
    repo: "eduvijna-ai/eduvijna-aieos-infrastructure",
    sha: "a8654e5bc680eac1fa93cf8308d7cad904f4d7b9",
  },
};

export const OPENAPI_AUTHORITY_SHA =
  "4042FB2725DA70A02A70EE09563B7698AE2E5DA82927614CAF1B5F7E6AA7C1D0";

export const EXPECTED_MIGRATION_HEAD = "a360s010004";

/** Canonical governed synthetic tenant for loopback Provider Aggregator reads. */
export const GOVERNED_SYNTHETIC_TENANT_ID =
  "71b5fb49-2bdb-56c3-ab7c-3b33e92a89f0";

export const TENANT_ID_HEADER = "X-AIEOS-Tenant-ID";
