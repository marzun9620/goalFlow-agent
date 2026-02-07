import { Layer } from "effect";
import { MatchingRepositoryLive } from "../repositories/matchingRepository.js";
import { MatchEmployeeUseCaseLive } from "../use-cases/matching/matchEmployeeUseCase.js";
import type { MatchEmployeeUseCase } from "../use-cases/matching/matchEmployeeUseCase.js";
import type { MatchingRepository } from "../use-cases/matching/repository.js";
import type { AppConfig } from "./config.js";
import { AppConfigLive } from "./config.js";
import type { Database } from "./database.js";
import { DatabaseLive } from "./database.js";
import { LoggerLayer } from "./logger.js";

// Build layers with proper dependency order:
// 1. AppConfig + Logger (no deps)
// 2. Database (needs AppConfig)
// 3. MatchingRepository (needs Database)
// 4. MatchEmployeeUseCase (needs MatchingRepository)
const BaseLayer = Layer.mergeAll(AppConfigLive, LoggerLayer);
const DbLayer = Layer.provideMerge(DatabaseLive, BaseLayer);
const RepoLayer = Layer.provideMerge(MatchingRepositoryLive, DbLayer);
const UseCaseLayer = Layer.provideMerge(MatchEmployeeUseCaseLive, RepoLayer);

export const AppLayer = UseCaseLayer;

export type AppServices = AppConfig | Database | MatchingRepository | MatchEmployeeUseCase;
