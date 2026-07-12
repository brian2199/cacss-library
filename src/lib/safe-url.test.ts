import { describe, expect, it } from "vitest";
import { sanitizeCallbackUrl } from "./safe-url";

describe("sanitizeCallbackUrl", () => {
  it("allows relative paths", () => {
    expect(sanitizeCallbackUrl("/checkout")).toBe("/checkout");
  });

  it("blocks external URLs", () => {
    expect(sanitizeCallbackUrl("https://evil.example")).toBe("/catalog");
    expect(sanitizeCallbackUrl("//evil.example/path")).toBe("/catalog");
  });

  it("uses fallback for empty", () => {
    expect(sanitizeCallbackUrl(null, "/dashboard")).toBe("/dashboard");
  });
});
