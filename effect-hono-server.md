# Effect + Hono in backendv2

Comprehensive guide to how Effect is integrated with the Hono server and patterns for adding routes, middleware, and services.

---

## Table of Contents
1. [Runtime Wiring](#runtime-wiring)
2. [Route Pattern](#route-pattern-effect-inside-hono)
3. [Middleware Pattern](#middleware-pattern)
4. [Error and Schema Handling](#error-and-schema-handling)
5. [Resources and Lifecycles](#resources-and-lifecycles)
6. [Adding a New Route](#adding-a-new-route-recipe)
7. [Adding a New UseCase](#adding-a-new-usecase-recipe)

---

## Runtime Wiring

### AppLayer - Dependency Graph (`src/packages/server/layer.ts`)

The `AppLayer` defines the complete dependency graph available to all request handlers. It uses Effect's `Layer` API to compose services:

```typescript
export const AppLayer = Layer.mergeAll(
  SuperSimpleUsecase.Default,
  VerifySessionUseCase.Default,
  AuthUseCase.Default,
  SignupUseCase.Default,
  AppConfig.Default,
).pipe(
  Layer.provideMerge(Database.Default),
  Layer.provideMerge(VerifiedEmailTokenService.Default),
);

export type AppLayer =
  | SuperSimpleUsecase
  | VerifySessionUseCase
  | AuthUseCase
  | SignupUseCase
  | AppConfig
  | Database
  | VerifiedEmailTokenService;
```

**Key concepts:**
- `Layer.mergeAll()` combines multiple service layers horizontally (independent services)
- `Layer.provideMerge()` provides dependencies to layers that require them (Database is needed by repositories)
- The type export ensures TypeScript knows what services are available in the layer

### HonoServer - Per-Request Runtime (`src/packages/server/index.ts`)

The `HonoServer` is an Effect Service with a scoped lifecycle that:
1. Creates the Hono app instance
2. Applies global middleware (requestId, logger, CORS)
3. Creates a per-request Effect runtime
4. Handles unhandled errors globally

```typescript
export class HonoServer extends Effect.Service<HonoServer>()("HonoServer", {
  scoped: Effect.gen(function* () {
    const app = new Hono<ServerEnv>();
    const scope = yield* Effect.scope;

    // Global middleware
    app.use("*", requestId());
    app.use("*", logger());

    // CORS handling (reads from env)
    const corsOrigins = (process.env.CORS_ALLOW_ORIGINS ?? "")
      .split(",")
      .filter((origin) => origin.length > 0);

    if (corsOrigins.length > 0) {
      app.use("*", async (c, next) => {
        const origin = c.req.header("origin");
        if (origin && corsOrigins.includes(origin)) {
          c.header("Access-Control-Allow-Origin", origin);
          c.header("Vary", "Origin");
          // ... other CORS headers
        }
        if (c.req.method === "OPTIONS") {
          return c.body(null, 204);
        }
        await next();
      });
    }

    // Per-request fiber runtime with AppLayer
    const runFork = yield* FiberSet.makeRuntime<AppLayer>().pipe(
      Scope.extend(scope),
    );

    // Inject request runner into Hono context
    app.use("*", async (c, next) => {
      c.set("run", async <A, E>(eff: Effect.Effect<A, E, AppLayer>) => {
        const wrapped = eff.pipe(
          Effect.onExit((exit) =>
            Exit.isFailure(exit) && !Cause.isInterruptedOnly(exit.cause)
              ? Effect.logWarning("Unhandled error in route", exit.cause)
              : Effect.void,
          ),
        );
        const fiber = runFork(wrapped);

        // Interrupt fiber if client disconnects (abort signal)
        c.req.raw.signal.addEventListener("abort", () =>
          fiber.unsafeInterruptAsFork(FiberId.none),
        );

        const exit = await Effect.runPromiseExit(Fiber.join(fiber));
        if (Exit.isSuccess(exit)) {
          return exit.value;
        }
        // Extract failure or throw squashed cause
        const failure = Cause.failureOption(exit.cause);
        if (Option.isSome(failure)) {
          throw failure.value;
        }
        throw Cause.squash(exit.cause);
      });
      await next();
    });

    // Global error handler
    app.onError((err, c) => {
      if (isHttpError(err)) {
        return c.json(err.toJSON(), err.status as ContentfulStatusCode);
      }
      return c.json({
        status: 500,
        title: "Internal Server Error",
        type: "about:blank",
        detail: "An unexpected error occurred.",
      }, 500);
    });

    // Graceful server lifecycle
    yield* Effect.acquireRelease(
      Effect.sync(() => serve({ fetch: app.fetch, port: 3000 })),
      (sv) => Effect.async((resume) => {
        sv.close(() => resume(Effect.void));
      }),
    );

    return { app } as const;
  }),
  dependencies: [
    SuperSimpleUsecase.Default,
    VerifySessionUseCase.Default,
    AuthUseCase.Default,
    SignupUseCase.Default,
    AppConfig.Default,
  ],
}) {}
```

**Key concepts:**
- `FiberSet.makeRuntime<AppLayer>()` creates a runtime that forks effects with `AppLayer` in scope
- `Scope.extend(scope)` ties the fiber runtime to the server's lifecycle
- `c.var.run()` is injected into every request context for executing Effects
- Abort signals automatically interrupt fibers when clients disconnect
- `app.onError()` catches all unhandled errors and converts `HttpError` to RFC 7807 problem JSON

### Entry Point (`src/index.ts`)

```typescript
const program = Layer.launch(setup).pipe(
  Effect.provide(AppLayer),
);

NodeRuntime.runMain(program);
```

---

## Route Pattern (Effect inside Hono)

Routes use `hono-openapi` for schema-driven validation and documentation.

### Basic Route Structure (`src/adapter/routes/sample/index.ts`)

```typescript
export const simpleRoute = new Hono<ServerEnv>().get(
  "/simple",
  describeRoute({
    responses: {
      200: {
        description: "Successful response",
        content: {
          "application/json": {
            schema: resolver(SampleResponseSchema),
          },
        },
      },
    },
  }),
  effectValidator("query", SampleSchema),  // Validates query parameters
  async (c) => {
    const query = c.req.valid("query");  // Safe parsed input

    const eff = Effect.gen(function* () {
      const uc = yield* SuperSimpleUsecase;
      return yield* uc.do();
    });

    await c.var.run(eff);
    return c.json({ query });
  },
);
```

### Full Route with Error Handling (`src/adapter/routes/auth/index.ts`)

```typescript
authRoute.post(
  "/signin",
  describeRoute({
    summary: "Sign in",
    tags: ["Auth"],
    responses: {
      200: {
        description: "Signed in",
        content: {
          "application/json": { schema: resolver(SigninResponseSchema) },
        },
      },
      400: {
        description: "Bad request",
        content: {
          "application/json": { schema: resolver(AuthProblemDetailsSchema) },
        },
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": { schema: resolver(AuthProblemDetailsSchema) },
        },
      },
    },
  }),
  effectValidator("json", SigninRequestSchema),
  async (c) => {
    const credentials = c.req.valid("json");

    try {
      const result = await c.var.run(
        Effect.gen(function* () {
          const auth = yield* AuthUseCase;
          return yield* auth.signin(credentials);
        }),
      );

      applyRefreshCookie(c, result.refreshCookie);
      return c.json({
        accessToken: result.tokens.access,
        csrfToken: result.csrfToken,
        session: result.session,
      });
    } catch (error) {
      const problem = toProblem(error) ?? internalServerError({
        detail: "Unexpected error.",
        extensions: { code: "AUTH_UNEXPECTED_ERROR" },
      });
      return respond(c, problem);
    }
  },
);
```

**Pattern summary:**
1. `describeRoute()` - OpenAPI documentation
2. `effectValidator("json" | "query" | "param", Schema)` - Request validation
3. `c.req.valid("json")` - Access validated input
4. `c.var.run(Effect.gen(...))` - Execute Effect with AppLayer
5. `toProblem(error)` - Map domain errors to HTTP problems
6. `respond(c, problem)` - Return RFC 7807 JSON response

---

## Middleware Pattern

### Authentication Middleware (`src/adapter/middleware/authentication.ts`)

```typescript
export const authentication: MiddlewareHandler<ServerEnv> = async (c, next) => {
  // Step 1: Parse bearer token
  const accessToken = parseAuthorizationHeader(c.req.header("authorization"));

  if (!accessToken) {
    return respond(c, unauthorized({
      detail: "Missing bearer token.",
      extensions: { code: "AUTH_MISSING_BEARER_TOKEN" },
    }));
  }

  try {
    // Step 2: Verify token via use case with tracing
    const result = await c.var.run(
      Effect.gen(function* () {
        const service = yield* VerifySessionUseCase;
        return yield* service.verify({ accessToken });
      }).pipe(Effect.withSpan("authenticationMiddleware.verify")),
    );

    // Step 3: Set derived values on context for downstream handlers
    c.set("principal", result.principal);
    c.set("session", result.session);
    c.set("claims", result.claims);

    await next();
  } catch (error) {
    // Step 4: Map specific errors to problem responses
    if (error instanceof AuthenticationError) {
      const info = authErrorInfo(error);
      return respond(c, unauthorized({
        detail: info.detail,
        extensions: { code: info.code },
      }));
    }

    if (isAuthorizationError(error)) {
      return respond(c, forbidden({
        detail: "Access to this resource is forbidden.",
        extensions: { code: "AUTH_FORBIDDEN" },
      }));
    }

    if (error instanceof AuthRepositoryError) {
      return respond(c, internalServerError({
        detail: "Authentication service is unavailable.",
        extensions: { code: "AUTH_REPOSITORY_FAILURE" },
      }));
    }

    // Rethrow unknown errors to global handler
    throw error;
  }
};

// Error detail mapper
const authErrorInfo = (error: AuthenticationError): { detail: string; code: string } => {
  switch (error.reason) {
    case "invalidToken":
      return { detail: "Access token is invalid.", code: "AUTH_INVALID_TOKEN" };
    case "tokenMismatch":
      return { detail: "Token data does not match the active session.", code: "AUTH_TOKEN_MISMATCH" };
    case "sessionExpired":
      return { detail: "Session has expired.", code: "AUTH_SESSION_EXPIRED" };
    default:
      return { detail: "Authentication failed.", code: "AUTH_UNEXPECTED_ERROR" };
  }
};
```

**Middleware pattern:**
1. Extract and validate input (tokens, headers)
2. Fail fast with problem responses for missing/invalid input
3. Call use cases via `c.var.run()` with spans for tracing
4. Map domain/auth errors to HTTP problem details
5. Set derived values on `c.var` (principal, session, claims)
6. Rethrow unknown errors to be caught by global handler

---

## Error and Schema Handling

### Tagged Error Definitions

**Domain errors** (`src/domain/auth/errors.ts`):
```typescript
export class RoleNotAllowedError extends Data.TaggedError("RoleNotAllowedError")<{
  readonly principalRole: Role;
  readonly allowedRoles: ReadonlyArray<Role>;
}> {}

export class CompanyScopeMismatchError extends Data.TaggedError("CompanyScopeMismatchError")<{
  readonly principalCompanyId: CompanyId;
  readonly resourceCompanyId: CompanyId;
  readonly allowServiceAdminBypass: boolean;
}> {}
```

**UseCase errors** (`src/usecase/auth/errors.ts`):
```typescript
export class AuthenticationError extends Data.TaggedError("AuthenticationError")<{
  readonly reason?: string;
}> {}

export class AuthRepositoryError extends Data.TaggedError("AuthRepositoryError")<{
  readonly repository: "session" | "user";
  readonly cause: unknown;
}> {}
```

**Feature-specific errors** (`src/usecase/signup/errors.ts`):
```typescript
export class EmailAlreadyExistsError extends Data.TaggedError("EmailAlreadyExistsError")<{
  readonly email: string;
}> {}

export class CompanyNameTakenError extends Data.TaggedError("CompanyNameTakenError")<{
  readonly companyName: string;
}> {}

export class VerificationExpiredError extends Data.TaggedError("VerificationExpiredError")<{
  readonly email: string;
  readonly expiresAt: Date;
}> {}
```

### RFC 7807 Problem Details (`src/packages/server/types.ts`)

```typescript
export type ProblemDetails = {
  type?: string;      // URI identifying the problem type
  title?: string;     // Short, human-readable summary
  status: number;     // HTTP status code
  detail?: string;    // Human-readable explanation
  instance?: string;  // URI for specific occurrence
  extensions?: Record<string, unknown>;  // Custom fields (e.g., error codes)
};

export class HttpError extends Data.TaggedError("HttpError")<ProblemDetails> {
  toJSON() {
    const base = {
      type: this.type ?? "about:blank",
      title: this.title ?? defaultTitle(this.status),
      status: this.status,
      ...(this.detail !== undefined ? { detail: this.detail } : {}),
      ...(this.instance !== undefined ? { instance: this.instance } : {}),
    } as Record<string, unknown>;

    // Merge extension members (e.g., error codes)
    if (this.extensions) {
      for (const [k, v] of Object.entries(this.extensions)) {
        if (["type", "title", "status", "detail", "instance"].includes(k)) continue;
        base[k] = v;
      }
    }
    return base;
  }
}

// Convenience constructors
export const badRequest = (arg?: string | ProblemInit) => makeProblem(400, initFrom(arg));
export const unauthorized = (arg?: string | ProblemInit) => makeProblem(401, initFrom(arg));
export const forbidden = (arg?: string | ProblemInit) => makeProblem(403, initFrom(arg));
export const notFound = (arg?: string | ProblemInit) => makeProblem(404, initFrom(arg));
export const conflict = (arg?: string | ProblemInit) => makeProblem(409, initFrom(arg));
export const internalServerError = (arg?: string | ProblemInit) => makeProblem(500, initFrom(arg));
```

### Error Mapping in Routes

```typescript
const toProblem = (error: unknown): HttpError | null => {
  if (error instanceof EmailAlreadyExistsError) {
    return conflict({ detail: "Email already registered." });
  }
  if (error instanceof CompanyNameTakenError) {
    return conflict({ detail: "Company name already taken." });
  }
  if (error instanceof VerificationExpiredError) {
    return unauthorized({ detail: "Verification code expired." });
  }
  if (error instanceof InvalidVerificationCodeError) {
    return unauthorized({ detail: "Invalid verification code." });
  }
  if (error instanceof SignupFlowError) {
    return internalServerError({
      detail: `Signup failed during ${error.operation}. Please try again.`,
    });
  }
  return null;  // Let unknown errors bubble to global handler
};
```

### Schema Validation (`src/adapter/routes/schema/auth.ts`)

```typescript
const NonEmptyString = Schema.String.pipe(Schema.minLength(1));

export const SigninRequestSchema = Schema.standardSchemaV1(
  Schema.Struct({
    email: NonEmptyString,
    password: NonEmptyString,
  }).annotations({
    identifier: "SignInRequest",
    description: "Sign in credentials",
  }),
);

export const SigninResponseSchema = Schema.standardSchemaV1(
  Schema.Struct({
    accessToken: NonEmptyString,
    csrfToken: NonEmptyString,
    session: SessionRecordSchema,
  }).annotations({
    identifier: "SignInResponse",
    description: "Sign in response with tokens and session",
  }),
);
```

**Schema pattern:**
- Use Effect's `Schema` module for runtime validation
- `standardSchemaV1` makes schemas compatible with hono-openapi
- Annotations provide OpenAPI documentation
- Compose from domain types for consistency

---

## Resources and Lifecycles

### Database Service (`src/packages/database/index.ts`)

```typescript
export class Database extends Effect.Service<Database>()("@package/Database", {
  scoped: Effect.gen(function* () {
    const config = yield* DatabaseConfig;
    const prisma = new PrismaClient(buildPrismaOptions(config));
    const slowQueryThreshold = config.logQueryThresholdMs;
    const scope = yield* Effect.scope;

    // Log slow queries
    prisma.$on("query", (event) => {
      if (event.duration >= slowQueryThreshold) {
        console.info(`[prisma] ${event.duration.toFixed(1)}ms ${event.query}`);
      }
    });

    // Connect with error handling
    yield* Effect.tryPromise({
      try: () => prisma.$connect(),
      catch: (cause) => new DatabaseError({ operation: "connect", cause }),
    });

    // Add finalizer for graceful disconnection
    yield* Scope.addFinalizer(
      scope,
      Effect.tryPromise({
        try: () => prisma.$disconnect(),
        catch: (cause) => new DatabaseError({ operation: "disconnect", cause }),
      }).pipe(
        Effect.catchAll((error) =>
          Effect.logWarning("Prisma disconnect failed", error),
        ),
      ),
    );

    return { prisma } satisfies DatabaseService;
  }),
  dependencies: [DatabaseConfig.Default],
}) {}
```

**Lifecycle pattern:**
- `scoped` acquires resources on startup
- `Scope.addFinalizer()` registers cleanup on shutdown
- Error handling wraps external operations

### Configuration Service (`src/packages/configuration/index.ts`)

```typescript
export class AppConfig extends Effect.Service<AppConfig>()("@package/AppConfig", {
  effect: Effect.gen(function* () {
    const database = yield* readConfig(
      Config.all({
        url: Config.string("DATABASE_URL"),
        logQueryThresholdMs: Config.withDefault(75)(
          Config.number("DB_QUERY_LOG_THRESHOLD_MS"),
        ),
      }),
    );

    const session = yield* readConfig(
      Config.all({
        expiresInHours: Config.number("SESSION_EXPIRES_HOURS"),
        cookieName: Config.string("SESSION_COOKIE_NAME"),
        secrets: Config.redacted("SESSION_SECRET").pipe(
          Config.map((value) => Redacted.value(value).split(",")),
        ),
        // ... more config
      }),
    );

    return { database, session, /* ... */ } satisfies AppConfigData;
  }),
}) {}
```

**Config pattern:**
- Uses Effect's `Config` combinators
- `Config.redacted()` for secrets (not logged)
- `Config.withDefault()` for optional values
- Structured types for type safety

### Security Token Service (`src/packages/security/verifiedEmailTokenService.ts`)

```typescript
export class VerifiedEmailTokenService extends Effect.Service<VerifiedEmailTokenService>()(
  "@package/VerifiedEmailTokenService",
  {
    effect: Effect.gen(function* () {
      const config = yield* AppConfig;
      const [primarySecret, ...otherSecrets] = config.session.secrets;

      // Key rotation: try verification against multiple secrets
      const verifyAgainstSecrets = <A>(
        verify: (secret: string) => Effect.Effect<A, JwtVerifyError>,
        secrets: ReadonlyArray<string>,
      ): Effect.Effect<A, JwtVerifyError> => {
        const loop = (index: number, lastError?: JwtVerifyError): Effect.Effect<A, JwtVerifyError> => {
          if (index >= secrets.length) {
            return Effect.fail(lastError ?? new JwtVerifyError({ cause: new Error("No secrets") }));
          }
          return verify(secrets[index]).pipe(
            Effect.catchAll((error) => loop(index + 1, error)),
          );
        };
        return loop(0);
      };

      return {
        create: ({ email, expiresInSeconds }) =>
          Effect.gen(function* () {
            const now = Math.floor(Date.now() / 1000);
            const exp = now + expiresInSeconds;
            return yield* Effect.tryPromise({
              try: () =>
                new SignJWT({ email, exp })
                  .setProtectedHeader({ alg: "HS256" })
                  .sign(encoder.encode(primarySecret)),
              catch: (cause) => new JwtSignError({ cause }),
            });
          }),

        verify: (token) =>
          verifyAgainstSecrets(
            (secret) => Effect.tryPromise({
              try: () => jwtVerify(token, encoder.encode(secret)),
              catch: (cause) => new JwtVerifyError({ cause }),
            }).pipe(Effect.map((r) => r.payload)),
            [primarySecret, ...otherSecrets].filter(Boolean),
          ).pipe(
            Effect.flatMap((payload) =>
              Schema.decodeUnknown(VerifiedEmailPayloadSchema)(payload).pipe(
                Effect.mapError((cause) => new JwtVerifyError({ cause })),
              ),
            ),
          ),
      };
    }),
    dependencies: [AppConfig.Default],
  },
) {}
```

---

## Adding a New Route (Recipe)

1. **Create route file** at `src/adapter/routes/<feature>/index.ts`:
   ```typescript
   import { Hono } from "hono";
   import { describeRoute } from "hono-openapi";
   import { resolver } from "hono-openapi/effect";
   import { effectValidator } from "@hono/effect-validator";
   import type { ServerEnv } from "@/packages/server/types";

   export const featureRoute = new Hono<ServerEnv>();
   ```

2. **Define schemas** at `src/adapter/routes/schema/<feature>.ts`:
   ```typescript
   import { Schema } from "effect";

   export const CreateFeatureRequestSchema = Schema.standardSchemaV1(
     Schema.Struct({
       name: Schema.String.pipe(Schema.minLength(1)),
     }).annotations({ identifier: "CreateFeatureRequest" }),
   );

   export const FeatureResponseSchema = Schema.standardSchemaV1(
     Schema.Struct({
       id: Schema.String,
       name: Schema.String,
     }).annotations({ identifier: "FeatureResponse" }),
   );
   ```

3. **Implement handler**:
   ```typescript
   featureRoute.post(
     "/",
     describeRoute({
       summary: "Create feature",
       tags: ["Feature"],
       responses: {
         201: {
           description: "Created",
           content: { "application/json": { schema: resolver(FeatureResponseSchema) } },
         },
         400: { description: "Bad request", content: { "application/json": { schema: resolver(ProblemSchema) } } },
       },
     }),
     effectValidator("json", CreateFeatureRequestSchema),
     async (c) => {
       const input = c.req.valid("json");

       try {
         const result = await c.var.run(
           Effect.gen(function* () {
             const usecase = yield* FeatureUseCase;
             return yield* usecase.create(input);
           }),
         );
         return c.json(result, 201);
       } catch (error) {
         const problem = toProblem(error) ?? internalServerError({ detail: "Unexpected error." });
         return respond(c, problem);
       }
     },
   );
   ```

4. **Define error mapper**:
   ```typescript
   const toProblem = (error: unknown): HttpError | null => {
     if (error instanceof FeatureNameTakenError) {
       return conflict({ detail: "Feature name already exists." });
     }
     if (error instanceof ValidationError) {
       return badRequest({ detail: error.message });
     }
     return null;
   };
   ```

5. **Mount in setup** (`src/setup.ts`):
   ```typescript
   import { featureRoute } from "@/adapter/routes/feature";

   export const apiRoutes = new Hono<ServerEnv>()
     .route("/api/feature", featureRoute);
   ```

---

## Adding a New UseCase (Recipe)

1. **Define errors** at `src/usecase/<feature>/errors.ts`:
   ```typescript
   import { Data } from "effect";

   export class FeatureNotFoundError extends Data.TaggedError("FeatureNotFoundError")<{
     readonly id: string;
   }> {}

   export class FeatureRepositoryError extends Data.TaggedError("FeatureRepositoryError")<{
     readonly operation: string;
     readonly cause: unknown;
   }> {}
   ```

2. **Define repository interface** at `src/usecase/<feature>/repository.ts`:
   ```typescript
   import { Effect } from "effect";

   export interface FeatureRepository {
     findById: (id: string) => Effect.Effect<Feature | null, FeatureRepositoryError>;
     create: (input: CreateFeatureInput) => Effect.Effect<Feature, FeatureRepositoryError>;
   }

   export class FeatureRepository extends Effect.Service<FeatureRepository>()(
     "@repository/FeatureRepository",
     {
       // Implementation provided by infra layer
     },
   ) {}
   ```

3. **Implement usecase** at `src/usecase/<feature>/featureUseCase.ts`:
   ```typescript
   import { Effect } from "effect";

   export interface FeatureUseCaseService {
     create: (input: CreateFeatureInput) => Effect.Effect<Feature, FeatureFlowError>;
     getById: (id: string) => Effect.Effect<Feature, FeatureFlowError>;
   }

   export class FeatureUseCase extends Effect.Service<FeatureUseCase>()(
     "@usecase/FeatureUseCase",
     {
       effect: Effect.gen(function* () {
         const repository = yield* FeatureRepository;
         const dateService = yield* DateService;

         const create: FeatureUseCaseService["create"] = (input) =>
           Effect.gen(function* () {
             const now = yield* dateService.now();
             const feature = buildFeature(input, now);
             return yield* repository.create(feature).pipe(
               Effect.mapError((e) => new FeatureFlowError({ operation: "create", cause: e })),
             );
           }).pipe(Effect.withSpan("FeatureUseCase.create"));

         const getById: FeatureUseCaseService["getById"] = (id) =>
           Effect.gen(function* () {
             const feature = yield* repository.findById(id);
             if (!feature) {
               return yield* Effect.fail(new FeatureNotFoundError({ id }));
             }
             return feature;
           }).pipe(Effect.withSpan("FeatureUseCase.getById"));

         return { create, getById } satisfies FeatureUseCaseService;
       }),
       dependencies: [FeatureRepository.Default, DateService.Default],
     },
   ) {}
   ```

4. **Add to AppLayer** (`src/packages/server/layer.ts`):
   ```typescript
   export const AppLayer = Layer.mergeAll(
     // ... existing
     FeatureUseCase.Default,
   ).pipe(
     Layer.provideMerge(Database.Default),
     // ...
   );
   ```

---

## Summary

Following these patterns ensures:
- **Request cancellation** via abort signals interrupting fibers
- **Type safety** through Effect and Schema
- **Testability** through dependency injection
- **Observability** through spans and structured logging
- **Consistent error handling** with RFC 7807 problem details
- **Clean separation** between transport (routes), business logic (usecases), and infrastructure (repositories, gateways)
