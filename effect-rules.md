# Effect usage in client and server

This note records how Effect is wired into the two v2 codebases so future changes stay consistent.

## Goals we get from Effect

- Typed configuration and secrets via `Config` plus `Redacted`.
- Dependency injection with `Effect.Service` and `Layer` instead of manual wiring.
- Safer interop with promises/IO (`try`, `tryPromise`, `timeoutFail`, `retry`).
- Domain-safe validation with `Schema` and branded types.
- Request-scoped lifecycles (`scoped`, `ManagedRuntime`, `FiberSet`) and structured errors (`Data.TaggedError`, `Cause`).

## client (React Router app)

- **Configuration layer**: `shared/config/config.ts` defines `AppConfig` as a service that loads env vars for app env, HTTP client, and session cookies. Values are strongly typed, sanitized (e.g., base URL trimmed), and secrets are kept redacted.
- **HTTP client wrapper**: `shared/api/httpClient.ts` builds the OpenAPI client and exports helpers `withRetry` (exponential backoff + max retries) and `withTimeout` (`timeoutFail`). Errors are normalized into `ApiError`/`NetworkError`/`TimeoutError` before bubbling.
- **Runtime bridge**: `shared/lib/runtime.server.ts` exposes `makeReactRouterRuntime`, giving `loaderFn`/`actionFn` wrappers so React Router loaders/actions run inside a managed Effect runtime with the provided layer.
- **CSRF storage service**: `shared/lib/csrf.server.ts` wraps `createCookieSessionStorage` with `Effect.tryPromise`, exposing `save/get/clear` and a tagged `CsrfStorageError`. Cookie secrets come from env via `SESSION_SECRET`.
- **Domain value objects**: `entities/session/model/*.ts` (email, username, password, companyName, verificationCode, etc.) use `Schema` to brand types and `Effect.fail` with `AuthValueError` for user-friendly validation messages.
- **Auth HTTP service**: `pages/signin/api/signin.server.ts` is an `Effect.Service` that scopes an `AbortController`, calls the backend with retry/timeout, maps transport problems with `Match`, logs failures, and returns structured `SignInResult`.
- **Action handlers**: `pages/api/auth/signin.server.ts` (and other `/pages/api/auth/*`) wrap React Router actions in `Effect.gen`, parse `FormData` with `tryPromise`, build domain models, and translate tagged errors (`catchTags`) into consistent JSON responses while logging unknown causes (`Cause.pretty`).
- **Runtime entrypoint**: `pages/api/runtime.server.ts` merges the SignIn and CSRF services into a `Layer` and exports the `loaderFn`/`actionFn` used by API routes.
- **Tests**: `tests/entities/session/model/*.test.ts` exercise the smart constructors with `Effect.either` to assert success/failure paths, keeping validation logic pure.

## server (Hono + Prisma API)

- **AppConfig service**: `src/packages/configuration/index.ts` builds a typed config object (database/session/Firebase/OpenAI/email/signup) using `Config` with defaults and redacted secrets. Errors are wrapped in `AppConfigError`.
- **Layered composition**: `src/packages/server/layer.ts` merges use cases, config, DB, and security services into `AppLayer`, which is provided in `src/index.ts` via `Layer.launch` on `NodeRuntime`.
- **HTTP server lifecycle**: `src/packages/server/index.ts` defines `HonoServer` as a scoped service. It builds the Hono app, sets CORS, and uses `FiberSet.makeRuntime` to run per-request effects. Request aborts interrupt the fiber; unhandled failures are logged with `Cause` and converted to HTTP problem responses.
- **Database resource**: `src/packages/database/index.ts` is a scoped service creating a Prisma client, logging slow queries, connecting in `acquire` and disconnecting in a `Scope` finalizer with tagged `DatabaseError`.
- **Domain models with Schema**: `src/domain/auth/session.ts` (plus `domain/user`, `domain/company`) define branded schemas, decoding helpers that map to tagged errors, and pure state transitions (`expireSessionRecord`, `revokeSessionRecord`) expressed as Effects.
- **Security services**: `src/packages/security/verifiedEmailTokenService.ts` signs/verifies email tokens with multiple secrets and Schema validation; `src/infra/service/totp/index.ts` wraps OTPAuth with `try`/`withSpan`, supports custom charsets, and returns Effects for generate/verify.
- **Use cases**: `src/usecase/signup/signupUseCase.ts` orchestrates validation (`Schema.decodeUnknown`), repositories, gateways, TOTP, and Prisma transactions. It wraps external failures in `SignupFlowError`, uses `Option` to branch on existence, adds tracing via `withSpan`, and cleans up Firebase users on transaction failure.
- **Routing and auth**: Routes in `src/adapter/routes/*` run inside the request runtime (`HonoServer` middleware) and invoke use cases like `AuthUseCase`/`VerifySessionUseCase` through the injected `run` helper, keeping handlers thin and effectful.

## How to extend safely

- Define new dependencies as `Effect.Service` classes; expose `Default` layers so they can be merged in `frontendv2/pages/api/runtime.server.ts` or `backendv2/src/packages/server/layer.ts`.
- Validate incoming data with `Schema.decodeUnknown(...).pipe(Effect.mapError(<TaggedError>))` to keep branded types at boundaries.
- Wrap external I/O with `try`/`tryPromise`, add `timeoutFail` and `retry` where failure is transient, and log via `Effect.log*` or `withSpan` for traceability.
- When running in web handlers, keep route functions thin: build domain requests, call services/use cases, and handle errors with `catchTags` plus a final `catchAllCause` logger.
