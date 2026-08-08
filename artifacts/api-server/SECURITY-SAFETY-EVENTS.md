# Security and safety event controls

`safety_signal_detected` is a control/telemetry event, not a user record. It
must contain only the event name, detector version, retention class, and access
class. Message text or previews, email addresses, account/Clerk IDs, IP
addresses, conversation IDs, location, and other direct or linkable identifiers
are prohibited.

Events use the `security_safety_30d` retention class and must be automatically
deleted from the primary sink, replicas, and searchable indexes within **30
days**. Backups must expire on their normal encrypted rotation and must not be
restored for analytics.

Access uses the `security_response_only` class. It is deny-by-default and is
limited to the `security-incident-responder` and `safety-lead` roles using SSO,
MFA, least privilege, and audited access. Product support, coaches, engineering,
analytics, advertising, and model-training systems have no access. Export,
joining to account data, and secondary use are prohibited.

Production log routing must reject events whose schema contains fields beyond
the four allowlisted fields and must apply both classes above at ingestion.
Access and deletion controls are reviewed quarterly by the Safety and Security
owners.
