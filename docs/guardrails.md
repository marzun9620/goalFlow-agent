# Guardrails & Approvals (GoalFlow)

- **Moderation/PII:** Run inputs/outputs through moderation; redact obvious PII before tool calls; block unsafe content.
- **Hallucination checks:** Verify factual claims against DB/vector store; downgrade or reject unsupported responses.
- **Human approvals:** Require approval before writing calendar events, creating/updating project tasks, or assigning work that exceeds capacity/priority thresholds. Log approver, timestamp, and action payload.
- **Auth & roles:** Enforce roles (admin/manager/member); scope data by org/tenant. Reject actions lacking scope.
- **Audit/logging:** Record tool calls, approvals, external writes, and failures with correlation IDs; keep minimal necessary data for compliance.
- **Rate limits:** Apply per-user/app limits on API entry; throttle external connector calls to stay within provider quotas.
