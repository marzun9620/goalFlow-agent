import { Config, Context, Layer } from "effect";

export interface AppConfig {
	port: number;
	databaseUrl: string;
	nodeEnv: string;
}

export const AppConfig = Context.GenericTag<AppConfig>("AppConfig");

export const AppConfigLive = Layer.effect(
	AppConfig,
	Config.all({
		port: Config.number("PORT").pipe(Config.withDefault(3000)),
		databaseUrl: Config.string("DATABASE_URL"),
		nodeEnv: Config.string("NODE_ENV").pipe(Config.withDefault("development")),
	}),
);
