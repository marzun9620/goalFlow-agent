import { Layer } from "effect";
import { MatchingRepositoryLive } from "../repositories/matchingRepository.js";
import { SchedulingRepositoryLive } from "../repositories/schedulingRepository.js";
import {
	type MatchEmployeeUseCase,
	MatchEmployeeUseCaseLive,
	type MatchingConfig,
	MatchingConfigLive,
} from "../use-cases/matching/matchEmployeeUseCase.js";
import type { MatchingRepository } from "../use-cases/matching/repository.js";
import {
	type ProposeScheduleUseCase,
	ProposeScheduleUseCaseLive,
} from "../use-cases/scheduling/proposeScheduleUseCase.js";
import type { SchedulingRepository } from "../use-cases/scheduling/repository.js";
import type { AppConfig } from "./config.js";
import { AppConfigLive } from "./config.js";
import type { Database } from "./database.js";
import { DatabaseLive } from "./database.js";
import { LoggerLayer } from "./logger.js";

// Build layers with proper dependency order:
// 1. AppConfig + Logger + MatchingConfig (no deps)
// 2. Database (needs AppConfig)
// 3. Repositories (needs Database)
// 4. Use cases (needs repositories + config)
const BaseLayer = Layer.mergeAll(AppConfigLive, LoggerLayer, MatchingConfigLive);
const DbLayer = Layer.provideMerge(DatabaseLive, BaseLayer);
const RepoLayer = Layer.provideMerge(
	Layer.merge(MatchingRepositoryLive, SchedulingRepositoryLive),
	DbLayer,
);
const UseCaseLayer = Layer.provideMerge(
	Layer.merge(MatchEmployeeUseCaseLive, ProposeScheduleUseCaseLive),
	RepoLayer,
);

export const AppLayer = UseCaseLayer;

export type AppServices =
	| AppConfig
	| Database
	| MatchingRepository
	| MatchEmployeeUseCase
	| MatchingConfig
	| SchedulingRepository
	| ProposeScheduleUseCase;
