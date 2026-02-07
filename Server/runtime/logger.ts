import { LogLevel, Logger } from "effect";

export const LoggerLayer = Logger.minimumLogLevel(LogLevel.Info);
