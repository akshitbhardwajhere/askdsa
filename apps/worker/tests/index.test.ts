import { afterEach, describe, expect, it, vi } from "vitest";
import { main } from "../src/index.js";

describe("worker entry point", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not start merely by importing the module", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    expect(info).not.toHaveBeenCalled();
  });

  it("logs startup without claiming jobs are being processed", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    main();

    expect(info).toHaveBeenCalledWith("[worker] Worker process started");
    expect(info).toHaveBeenCalledWith(
      "[worker] No jobs are being processed yet",
    );
  });
});
