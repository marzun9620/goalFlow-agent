import { PrismaClient } from "@prisma/client";
import { Context, Effect, Layer, Scope } from "effect";
import { AppConfig } from "./config.js";

export interface Database {
	client: PrismaClient;
}

export const Database = Context.GenericTag<Database>("Database");

export const DatabaseLive = Layer.scoped(
	Database,
	Effect.gen(function* () {
		const config = yield* AppConfig;
		const scope = yield* Effect.scope;

		const client = new PrismaClient({
			log: ["warn", "error"],
			datasources: { db: { url: config.databaseUrl } },
		});

		yield* Effect.tryPromise({
			try: () => client.$connect(),
			catch: (cause) => new Error(`Failed to connect database: ${String(cause)}`),
		}).pipe(Effect.orDie);

		yield* Scope.addFinalizer(
			scope,
			Effect.tryPromise({
				try: () => client.$disconnect(),
				catch: (cause) => new Error(`Failed to disconnect database: ${String(cause)}`),
			}).pipe(Effect.orDie),
		);

		return { client };
	}),
);
