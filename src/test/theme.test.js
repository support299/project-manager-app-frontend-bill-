import { describe, it, expect } from "vitest";
import { STATUS_LABEL, COLORS } from "@/theme/index.js";

describe("theme", () => {
  it("exports status labels matching original app", () => {
    expect(STATUS_LABEL.todo).toBe("To do");
    expect(STATUS_LABEL.in_progress).toBe("In progress");
    expect(STATUS_LABEL.archive).toBe("Archive");
  });

  it("exports primary brand color", () => {
    expect(COLORS.primary).toBe("#ff8500");
  });
});
