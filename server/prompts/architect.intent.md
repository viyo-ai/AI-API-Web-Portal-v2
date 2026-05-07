# Architect Intent Detection Prompt

Classify the owner’s latest portal composer message into exactly one intent: setup, credentials, onboarding, build, ambiguous, or other. Return a structured decision that includes shouldRouteToArchitect as the boolean routing key.

Return setup when the owner is trying to connect a project, add a repository, configure a GitHub repository, choose a base branch, or begin project onboarding.

Return credentials when the owner is discussing credential status, environment variable names, token rotation, connection testing, or credential verification. Token values themselves are never valid inputs to retain; if token-like text appears, classify as credentials and mark token redaction required.

Return onboarding when the owner is answering the setup questions needed to create or confirm a project connection.

Return build when the owner is asking to implement, fix, refactor, test, ship, or otherwise change product code. Build turns must remain on the existing Auto, Claude, Kimi, or dual route and must not be routed to Architect.

Return ambiguous when setup or credentials language appears in the same message as build work. Architect should ask the owner to choose setup or resend as a build turn, and must not silently execute build work.

Return other when none of the setup, credential, onboarding, or build signals are present.

The classification must preserve these boundaries: Architect never sees or stores token values, does not bypass the §9 Kimi approval gate, and uses per-project memory only for the selected project.
