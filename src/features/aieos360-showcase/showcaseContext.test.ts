import { describe, expect, it } from "vitest";
import {
  isShowcaseActive,
  SHOWCASE_ACTIVE_VALUE,
  SHOWCASE_QUERY_KEY,
  withShowcaseAbsoluteUrl,
  withShowcaseQuery,
  withShowcaseSearchParamFields,
} from "./showcaseContext";

describe("showcase context helpers", () => {
  it("detects explicit showcase=1 only", () => {
    expect(
      isShowcaseActive(new URLSearchParams({ [SHOWCASE_QUERY_KEY]: SHOWCASE_ACTIVE_VALUE })),
    ).toBe(true);
    expect(isShowcaseActive(new URLSearchParams({ [SHOWCASE_QUERY_KEY]: "true" }))).toBe(
      false,
    );
    expect(isShowcaseActive(new URLSearchParams())).toBe(false);
  });

  it("merges showcase into internal paths without dropping existing query params", () => {
    expect(withShowcaseQuery("/teacher-os/assess?assignment_id=abc", true)).toBe(
      `/teacher-os/assess?assignment_id=abc&${SHOWCASE_QUERY_KEY}=${SHOWCASE_ACTIVE_VALUE}`,
    );
    expect(withShowcaseQuery("/student-os/home", false)).toBe("/student-os/home");
  });

  it("preserves showcase in assess query rewrites only when active", () => {
    expect(
      withShowcaseSearchParamFields(
        { assignment_id: "a1", assessment_id: "as1" },
        true,
      ),
    ).toEqual({
      assignment_id: "a1",
      assessment_id: "as1",
      [SHOWCASE_QUERY_KEY]: SHOWCASE_ACTIVE_VALUE,
    });
    expect(
      withShowcaseSearchParamFields(
        { assignment_id: "a1", assessment_id: "as1" },
        false,
      ),
    ).toEqual({ assignment_id: "a1", assessment_id: "as1" });
  });

  it("merges showcase into absolute rehearsal URLs", () => {
    expect(
      withShowcaseAbsoluteUrl("http://demo.local:5291/teacher-os/today"),
    ).toBe(
      `http://demo.local:5291/teacher-os/today?${SHOWCASE_QUERY_KEY}=${SHOWCASE_ACTIVE_VALUE}`,
    );
  });
});
