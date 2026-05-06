import type { Express, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

const dbMocks = vi.hoisted(() => ({
  upsertUser: vi.fn().mockResolvedValue(undefined),
}));

const sdkMocks = vi.hoisted(() => ({
  exchangeCodeForToken: vi.fn().mockResolvedValue({ accessToken: "oauth-access-token" }),
  getUserInfo: vi.fn().mockResolvedValue({
    openId: "oauth-open-id",
    name: "",
    email: "oauth@example.com",
    loginMethod: "manus",
  }),
  createSessionToken: vi.fn().mockResolvedValue("signed-session-token"),
  authenticateRequest: vi.fn(),
}));

vi.mock("./db", () => ({
  ...dbMocks,
}));

vi.mock("./_core/sdk", () => ({
  sdk: sdkMocks,
}));

import { registerOAuthRoutes } from "./_core/oauth";
import { createContext } from "./_core/context";

const originalNodeEnv = process.env.NODE_ENV;

function captureOAuthCallbackHandler() {
  let handler: ((req: Request, res: Response) => Promise<void>) | undefined;
  const app = {
    get: vi.fn((path: string, registeredHandler: typeof handler) => {
      if (path === "/api/oauth/callback") handler = registeredHandler;
    }),
  } as unknown as Express;

  registerOAuthRoutes(app);

  if (!handler) throw new Error("OAuth callback handler was not registered");
  return handler;
}

function makeResponse() {
  const res = {
    cookie: vi.fn(),
    redirect: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  } as unknown as Response & {
    cookie: ReturnType<typeof vi.fn>;
    redirect: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe("OAuth callback route", () => {
  it("sets a production-safe session cookie and redirects to the protected app shell after callback", async () => {
    process.env.NODE_ENV = "production";
    const handler = captureOAuthCallbackHandler();
    const res = makeResponse();

    await handler(
      {
        protocol: "http",
        headers: {},
        query: { code: "authorization-code", state: "encoded-state" },
      } as Request,
      res,
    );

    expect(sdkMocks.exchangeCodeForToken).toHaveBeenCalledWith("authorization-code", "encoded-state");
    expect(sdkMocks.getUserInfo).toHaveBeenCalledWith("oauth-access-token");
    expect(dbMocks.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        openId: "oauth-open-id",
        name: null,
        email: "oauth@example.com",
        loginMethod: "manus",
      }),
    );
    expect(sdkMocks.createSessionToken).toHaveBeenCalledWith("oauth-open-id", {
      name: "",
      expiresInMs: ONE_YEAR_MS,
    });
    expect(res.cookie).toHaveBeenCalledWith(
      COOKIE_NAME,
      "signed-session-token",
      expect.objectContaining({
        httpOnly: true,
        maxAge: ONE_YEAR_MS,
        path: "/",
        sameSite: "none",
        secure: true,
      }),
    );
    expect(res.redirect).toHaveBeenCalledWith(302, "/");
  });

  it("recognizes the callback session cookie on the next protected app request", async () => {
    process.env.NODE_ENV = "production";
    const handler = captureOAuthCallbackHandler();
    const res = makeResponse();

    await handler(
      {
        protocol: "http",
        headers: { "x-forwarded-proto": "https" },
        query: { code: "authorization-code", state: "encoded-state" },
      } as Request,
      res,
    );

    const [, sessionCookieValue] = res.cookie.mock.calls[0];
    const authenticatedUser = {
      id: 1,
      openId: "oauth-open-id",
      name: "THE CEO",
      email: "oauth@example.com",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date("2026-05-06T00:44:53.000Z"),
      updatedAt: new Date("2026-05-06T03:08:40.000Z"),
      lastSignedIn: new Date("2026-05-06T03:08:40.000Z"),
    };
    sdkMocks.authenticateRequest.mockResolvedValue(authenticatedUser);

    const ctx = await createContext({
      req: { headers: { cookie: `${COOKIE_NAME}=${sessionCookieValue}` } },
      res: {},
    } as Parameters<typeof createContext>[0]);

    expect(sdkMocks.authenticateRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { cookie: `${COOKIE_NAME}=signed-session-token` },
      }),
    );
    expect(ctx.user).toEqual(authenticatedUser);
  });
});
