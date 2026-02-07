export type SyncResult = {
	provider: string;
	itemsSynced: number;
	start: string;
	end: string;
};

export type NotificationRequest = {
	channel: "slack" | "teams" | "email";
	target: string;
	message: string;
};

export type NotificationResult = {
	channel: NotificationRequest["channel"];
	target: string;
	message: string;
	id: string;
};

export type ProjectSyncResult = {
	provider: "jira" | "notion" | "trello";
	taskId: string;
	status: "synced" | "skipped";
};
