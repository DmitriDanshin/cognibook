import pino from "pino";

const level =
    process.env.PINO_LOG_LEVEL ??
    (process.env.NODE_ENV === "development" ? "debug" : "info");
const isDev = process.env.NODE_ENV === "development";
const usePretty = isDev && process.env.PINO_PRETTY !== "false";

const prettyStream = (() => {
    if (!usePretty) return undefined;
    try {
        // Avoid pino transport resolution issues under Next bundling.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pretty = require("pino-pretty");
        return pretty({
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
        });
    } catch {
        return undefined;
    }
})();

export const logger = pino({ level }, prettyStream);

export function createLogger(name: string) {
    return logger.child({ name });
}
