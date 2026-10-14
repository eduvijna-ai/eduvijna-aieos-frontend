import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export const SHOWCASE_QUERY_KEY = "showcase";
export const SHOWCASE_ACTIVE_VALUE = "1";

export const SHOWCASE_LAUNCHER_PATH = "/showcase/aieos360";

export function isShowcaseActive(
  params: URLSearchParams | null | undefined,
): boolean {
  if (!params) return false;
  return params.get(SHOWCASE_QUERY_KEY) === SHOWCASE_ACTIVE_VALUE;
}

export function withShowcaseQuery(path: string, active: boolean): string {
  if (!active) return path;
  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const pathWithoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const [pathname, query = ""] = pathWithoutHash.split("?");
  const params = new URLSearchParams(query);
  params.set(SHOWCASE_QUERY_KEY, SHOWCASE_ACTIVE_VALUE);
  const qs = params.toString();
  return `${pathname}?${qs}${hash}`;
}

export function withShowcaseAbsoluteUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set(SHOWCASE_QUERY_KEY, SHOWCASE_ACTIVE_VALUE);
    return parsed.toString();
  } catch {
    return url;
  }
}

export function useShowcaseActive(): boolean {
  const [searchParams] = useSearchParams();
  return isShowcaseActive(searchParams);
}

export function useWithShowcase(path: string): string {
  const active = useShowcaseActive();
  return useMemo(() => withShowcaseQuery(path, active), [path, active]);
}

/** Merge assess/improve query rewrites without dropping active showcase context. */
export function withShowcaseSearchParamFields(
  fields: Record<string, string | undefined>,
  showcaseActive: boolean,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value) {
      next[key] = value;
    }
  }
  if (showcaseActive) {
    next[SHOWCASE_QUERY_KEY] = SHOWCASE_ACTIVE_VALUE;
  }
  return next;
}
