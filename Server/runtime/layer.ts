import { Layer } from "effect";
import { GoalRepositoryLive } from "../repositories/goalRepository.js";
import { MatchingRepositoryLive } from "../repositories/matchingRepository.js";
import { SchedulingRepositoryLive } from "../repositories/schedulingRepository.js";
import { type GoalService, GoalServiceLive } from "../use-cases/goals/goalService.js";
import type { GoalRepository } from "../use-cases/goals/repository.js";
import { type LlmAdapter, LlmAdapterStubLive } from "../use-cases/llm/adapter.js";
import { type Guardrails, GuardrailsLive } from "../use-cases/llm/guardrails.js";
import { type LlmService, LlmServiceLive } from "../use-cases/llm/llmService.js";
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
	Layer.mergeAll(MatchingRepositoryLive, SchedulingRepositoryLive, GoalRepositoryLive),
	DbLayer,
);

const LlmSupportLayer = Layer.merge(GuardrailsLive, LlmAdapterStubLive);
const LlmLayer = Layer.provideMerge(LlmServiceLive, LlmSupportLayer);

const UseCaseLayer = Layer.provideMerge(
	Layer.mergeAll(MatchEmployeeUseCaseLive, ProposeScheduleUseCaseLive, GoalServiceLive, LlmLayer),
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
	| ProposeScheduleUseCase
	| GoalRepository
	| GoalService
	| Guardrails
	| LlmAdapter
	| LlmService;
