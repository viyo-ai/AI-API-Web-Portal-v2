# Published Domain OAuth Validation

Date: 2026-05-06

The published domain `https://aicodwork-5kvwo4uo.manus.space/` was refreshed in the browser after deployment. The page rendered the authenticated protected workspace with a visible **Logout** button, configured Claude/Kimi badges, live task list, center task thread, and task files panel. This confirms that the published domain accepted the existing Manus OAuth session cookie and loaded the protected workspace rather than remaining on the public/login view.

The refreshed published page also showed the latest source-backed UI fixes from checkpoint `c7decbf8`: owner-facing records now use **AI coordinator** and **AI routing decision** language instead of default `Wrapper LLM` wording, the composer action reads **Send to task thread**, and the technical terminal/filesystem tools are hidden behind **Advanced technical tools** with a **Show advanced tools** disclosure. The default right sidebar is task-file-first and no Basic Shell Terminal is visible in the normal owner view.

No browser takeover was required because the browser was already authenticated for this domain. Therefore, the validation confirms session recognition and protected workspace access using the persisted OAuth session. It does not prove a fresh manual login from a logged-out browser during this pass, but it does confirm the session cookie is accepted and the protected workspace loads on the published domain.
