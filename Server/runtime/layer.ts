import { Effect, Layer } from "effect";
import { AgentRepositoryLive } from "../repositories/agentRepository.js";
import { GoalRepositoryLive } from "../repositories/goalRepository.js";
import { MatchingRepositoryLive } from "../repositories/matchingRepository.js";
import { SchedulingRepositoryLive } from "../repositories/schedulingRepository.js";
import { type AgentChatService, AgentChatServiceLive } from "../use-cases/agent/chatService.js";
import {
	type AgentExecutionService,
	AgentExecutionServiceLive,
} from "../use-cases/agent/executionService.js";
import type { AgentRepository } from "../use-cases/agent/repository.js";
import {
	type ApprovalService,
	ApprovalServiceLive,
} from "../use-cases/approvals/approvalService.js";
import {
	type ConnectorsService,
	ConnectorsServiceStubLive,
} from "../use-cases/connectors/connectorsService.js";
import { type GoalService, GoalServiceLive } from "../use-cases/goals/goalService.js";
import type { GoalRepository } from "../use-cases/goals/repository.js";
import {
	type LlmAdapter,
	LlmAdapterStubLive,
	LlmAdapter as LlmAdapterTag,
} from "../use-cases/llm/adapter.js";
import { type Guardrails, GuardrailsLive } from "../use-cases/llm/guardrails.js";
import { type LlmService, LlmServiceLive } from "../use-cases/llm/llmService.js";
import { LlmAdapterOpenAILive } from "../use-cases/llm/openaiAdapter.js";
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
import { type AppConfig, AppConfigLive, AppConfig as AppConfigTag } from "./config.js";
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
	Layer.mergeAll(
		MatchingRepositoryLive,
		SchedulingRepositoryLive,
		GoalRepositoryLive,
		AgentRepositoryLive,
	),
	DbLayer,
);

// Conditionally select LLM adapter: use OpenAI if API key is present, otherwise stub
const LlmAdapterLive = Layer.unwrapEffect(
	Effect.map(AppConfigTag, (config) =>
		config.openaiApiKey ? LlmAdapterOpenAILive : LlmAdapterStubLive,
	),
);

const LlmSupportLayer = Layer.merge(GuardrailsLive, LlmAdapterLive);
const LlmLayer = Layer.provideMerge(LlmServiceLive, LlmSupportLayer);
const AgentExecutionLayer = Layer.provide(AgentExecutionServiceLive, MatchEmployeeUseCaseLive);

const UseCaseLayer = Layer.provideMerge(
	Layer.mergeAll(
		MatchEmployeeUseCaseLive,
		ProposeScheduleUseCaseLive,
		GoalServiceLive,
		LlmLayer,
		ApprovalServiceLive,
		ConnectorsServiceStubLive,
		AgentChatServiceLive,
		AgentExecutionLayer,
	),
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
	| AgentRepository
	| AgentChatService
	| AgentExecutionService
	| Guardrails
	| LlmAdapter
	| LlmService
	| ApprovalService
	| ConnectorsService;
