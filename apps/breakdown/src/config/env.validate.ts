import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { EnvDto } from "./env.dto";

export function validateEnv(config: Record<string, unknown>): EnvDto {
  const env = plainToInstance(EnvDto, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(env, { whitelist: true });
  if (errors.length > 0) {
    const messages = errors.flatMap((e: { constraints?: Record<string, string> }) =>
      Object.values(e.constraints ?? {})
    );
    throw new Error(`Env validation failed:\n${messages.join("\n")}`);
  }

  const envRecord = env as unknown as Record<string, unknown>;
  if (!env.ANTHROPIC_API_KEY && !env.OPENAI_API_KEY && !envRecord.GOOGLE_API_KEY) {
    throw new Error(
      "At least one of ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY is required (Task Master needs an AI provider)"
    );
  }

  return env;
}
