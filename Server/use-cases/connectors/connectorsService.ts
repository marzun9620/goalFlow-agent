import { Context, Effect, Layer } from "effect";
import type {
	NotificationRequest,
	NotificationResult,
	ProjectSyncResult,
	SyncResult,
} from "../../domain/connectors/types.js";
import { ConnectorError } from "./errors.js";

export interface ConnectorsService {
	syncCalendar: (
		personId: string,
		start: Date,
		end: Date,
	) => Effect.Effect<SyncResult, ConnectorError>;
	sendNotification: (
		input: NotificationRequest,
	) => Effect.Effect<NotificationResult, ConnectorError>;
	syncProjectTask: (
		taskId: string,
		provider: ProjectSyncResult["provider"],
	) => Effect.Effect<ProjectSyncResult, ConnectorError>;
}

export const ConnectorsService = Context.GenericTag<ConnectorsService>("ConnectorsService");

const stubSync = (provider: string): SyncResult => ({
	provider,
	itemsSynced: 3,
	start: new Date().toISOString(),
	end: new Date().toISOString(),
});

const stubNotify = (input: NotificationRequest): NotificationResult => ({
	channel: input.channel,
	target: input.target,
	message: input.message,
	id: `stub-${Date.now()}`,
});

const stubProjectSync = (
	taskId: string,
	provider: ProjectSyncResult["provider"],
): ProjectSyncResult => ({
	provider,
	taskId,
	status: "synced",
});

const makeService = (): ConnectorsService => ({
	syncCalendar: (personId, start, end) =>
		Effect.try({
			try: () =>
				({
					...stubSync("google-calendar"),
					start: start.toISOString(),
					end: end.toISOString(),
					personId,
				}) as SyncResult & { personId: string },
			catch: (cause) => new ConnectorError({ provider: "calendar", operation: "sync", cause }),
		}) as Effect.Effect<SyncResult, ConnectorError>,

	sendNotification: (input) =>
		Effect.try({
			try: () => stubNotify(input),
			catch: (cause) => new ConnectorError({ provider: input.channel, operation: "notify", cause }),
		}),

	syncProjectTask: (taskId, provider) =>
		Effect.try({
			try: () => stubProjectSync(taskId, provider),
			catch: (cause) => new ConnectorError({ provider, operation: "projectSync", cause }),
		}),
});

export const ConnectorsServiceStubLive = Layer.succeed(ConnectorsService, makeService());
