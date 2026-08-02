# ADR 001: Privacy-preserving anonymous sessions

## Status

Accepted for Stage 2.

## Context

Campus Navigator does not require account registration, but the presence
service still needs a temporary identity for token authentication, duplicate
update rejection, heartbeat expiry, and stable representative actors.

Phone hardware identifiers are unnecessary and would create an avoidable
privacy boundary. A raw app installation identifier should also not appear in
logs or long-lived business state.

## Decision

The app will generate a random opaque installation ID. The gateway validates
it, derives an HMAC-SHA256 device reference with a server-only secret, and
discards the raw value. It then creates a temporary session ID and signs a
short-lived JWT whose subject is that session ID.

The JWT and identity HMAC use independent secrets. Access tokens travel in the
HTTP `Authorization` header rather than a URL query parameter.

## Consequences

- No name, email, phone number, or hardware identifier is required.
- Logs can exclude the raw installation ID by construction.
- Changing the identity secret changes future derived references.
- Stage 3 must plan secret rotation before durable device references are used.
- Anonymous clients remain self-reported; presence is an activity signal, not
  proof of a person's physical identity.
