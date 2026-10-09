import { describe, expect, it } from "vitest";
import { fieldErrors, safeNext } from "./form-errors";

describe("fieldErrors", () => {
  it("splits the API's detail string by field", () => {
    expect(fieldErrors("email: Enter a valid email address; password: Password must be at least 8 characters")).toEqual({
      email: "Enter a valid email address",
      password: "Password must be at least 8 characters",
    });
  });
  it("keeps the first message for a repeated field and ignores free text", () => {
    expect(fieldErrors("name: Too short; name: Too long")).toEqual({ name: "Too short" });
    expect(fieldErrors("Incorrect email or password.")).toEqual({});
    expect(fieldErrors("")).toEqual({});
  });
});

describe("safeNext", () => {
  it("allows same-site paths including query strings", () => {
    expect(safeNext("/meetings/3?tab=notes")).toBe("/meetings/3?tab=notes");
    expect(safeNext("/settings/email")).toBe("/settings/email");
  });
  it("refuses anything that could leave the site", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "evil.com", ""]) {
      expect(safeNext(bad)).toBe("/home");
    }
    expect(safeNext(null)).toBe("/home");
    expect(safeNext(undefined, "/home")).toBe("/home");
  });
  it("never bounces back to an auth page", () => {
    for (const p of ["/login", "/login?next=/x", "/signup", "/forgot-password", "/reset-password?token=abc"]) {
      expect(safeNext(p)).toBe("/home");
    }
    expect(safeNext("/loginfo")).toBe("/loginfo"); // only exact auth routes are excluded
  });
});
