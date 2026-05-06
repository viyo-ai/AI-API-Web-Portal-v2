# Claude Opus 4.7 Adaptive Thinking Findings

Source reviewed: Anthropic Claude API Docs, "Adaptive thinking", https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking.

Key implementation facts verified on 2026-05-06:

| Topic | Verified Finding | Implementation Implication |
|---|---|---|
| Supported model | Claude Opus 4.7 uses model identifier `claude-opus-4-7`. | All direct Claude Opus 4.7 request payloads must be checked for this model string or a central model constant. |
| Thinking mode | For Claude Opus 4.7, adaptive thinking is the only supported thinking mode. | The request must use `thinking: { type: "adaptive" }`, not manual extended thinking. |
| Disabled by default | Thinking is off unless `thinking: { type: "adaptive" }` is explicitly provided. | The provider layer must inject the field on every Claude Opus 4.7 call. |
| Rejected legacy shape | The documentation states that `thinking: { type: "enabled", budget_tokens: N }` is rejected with a 400 error on Claude Opus 4.7. | Do not use the older `budget_tokens` implementation for this model. |
| Optional effort | Adaptive thinking may be combined with an `effort` parameter to guide thinking depth. | If a provider-level effort is introduced, it should be explicit and tested; the minimum compliant change is `thinking: { type: "adaptive" }`. |

The inherited note expected `thinking: { type: "enabled", budget_tokens: N }`, but current Anthropic documentation says that shape is for older extended-thinking models and is rejected for Claude Opus 4.7. The implementation should therefore target `thinking: { type: "adaptive" }` for every Claude Opus 4.7 invocation.
