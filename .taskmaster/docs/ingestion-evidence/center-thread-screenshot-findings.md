# Center Thread Screenshot Findings

Date: 2026-05-06

The user-provided screenshot PDF shows that the center task thread currently presents a chronological raw event log in the normal owner view. Older setup/status events appear first, while the newest user-relevant content and composer sit below a long Claude planning response. This makes the page feel as though the latest message is buried instead of immediately visible.

The screenshot also shows that the center thread contains technical orchestration records such as **AI routing decision**, **AI coordinator**, **Claude planning or review**, and a long model-analysis block. Although the earlier Wrapper wording has largely been normalized, the center panel still reads like an internal execution log rather than a plain-English owner task thread. The required fix is to make the newest meaningful owner-facing message appear first by default and move raw orchestration detail behind an explicit details/history disclosure or otherwise summarize it.
