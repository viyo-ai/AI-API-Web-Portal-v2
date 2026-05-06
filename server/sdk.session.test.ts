import { describe, expect, it } from "vitest";
import { sdk } from "./_core/sdk";

describe("SDK session verification", () => {
  it("accepts a valid OAuth session token even when the display name is empty", async () => {
    const token = await sdk.signSession({
      openId: "user-without-display-name",
      appId: "workshop-app",
      name: "",
    });

    await expect(sdk.verifySession(token)).resolves.toEqual({
      openId: "user-without-display-name",
      appId: "workshop-app",
      name: "",
    });
  });
});
