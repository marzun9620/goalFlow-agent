import "dotenv/config";
import "dotenv/config";
import { NodeRuntime } from "@effect/platform-node";
import { serverProgram } from "./server.js";

NodeRuntime.runMain(serverProgram);
