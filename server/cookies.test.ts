import type { Request } from "express";
import { afterEach, describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./_core/cookies";

const originalNodeEnv = process.env.NODE_ENV;

function makeRequest(protocol: string, headers: Record<string, string | string[] | undefined> = {}) {
  return {
    protocol,
    headers,
  } as Request;
}

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe("getSessionCookieOptions", () => {
  it("forces a secure SameSite=None cookie in production even when the app receives HTTP from the proxy", () => {
    process.env.NODE_ENV = "production";

    const options = getSessionCookieOptions(makeRequest("http"));

    expect(options).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
    });
  });

  it("treats forwarded HTTPS as secure for preview and managed dev domains", () => {
    process.env.NODE_ENV = "development";

    const options = getSessionCookieOptions(
      makeRequest("http", { "x-forwarded-proto": "http, https" }),
    );

    expect(options).toMatchObject({
      sameSite: "none",
      secure: true,
    });
  });

  it("uses SameSite=Lax instead of an invalid SameSite=None cookie for plain local HTTP", () => {
    process.env.NODE_ENV = "development";

    const options = getSessionCookieOptions(makeRequest("http"));

    expect(options).toMatchObject({
      sameSite: "lax",
      secure: false,
    });
  });
});
