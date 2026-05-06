import { describe, expect, it } from "vitest";
import { testBuildTargetConnection } from "./buildRunner";

describe("Section 1 GitHub token secret validation", () => {
  it("validates BUILD_TARGET_GITHUB_TOKEN can access the selected Build Target repository", async () => {
    expect(process.env.BUILD_TARGET_GITHUB_TOKEN, "BUILD_TARGET_GITHUB_TOKEN must be injected for Section 1 acceptance").toBeTruthy();

    const result = await testBuildTargetConnection({
      repoUrl: "https://github.com/viyo-ai/AI-API-Web-Portal-v2.git",
      githubTokenEnvVar: "BUILD_TARGET_GITHUB_TOKEN",
      defaultBaseBranch: "main",
    });

    expect(result).toMatchObject({ status: "ok" });
  }, 30000);
});
