import { IsOptional, IsString, IsNumber, Min, MinLength } from "class-validator";
import { Transform } from "class-transformer";

export class EnvDto {
  @IsString({ message: "PLANE_API_URL must be a string" })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value || "https://api.plane.so")
  PLANE_API_URL?: string;

  @IsString({ message: "PLANE_API_KEY is required" })
  PLANE_API_KEY!: string;

  @IsString()
  @IsOptional()
  ANTHROPIC_API_KEY?: string;

  @IsString()
  @IsOptional()
  OPENAI_API_KEY?: string;

  @IsString({ message: "TASK_BREAKDOWN_API_KEY is required" })
  @MinLength(1, { message: "TASK_BREAKDOWN_API_KEY must not be empty" })
  TASK_BREAKDOWN_API_KEY!: string;

  @IsString()
  @IsOptional()
  DEFAULT_MODEL?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value != null && typeof value === "string"
      ? parseInt(value, 10)
      : value != null && typeof value === "number"
        ? value
        : 10
  )
  @IsNumber()
  @Min(1)
  MAX_TASKS_DEFAULT?: number = 10;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value != null && typeof value === "string"
      ? parseInt(value, 10)
      : value != null && typeof value === "number"
        ? value
        : undefined
  )
  @IsNumber()
  @Min(0)
  CACHE_TTL?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value != null && typeof value === "string"
      ? parseInt(value, 10)
      : value != null && typeof value === "number"
        ? value
        : 120_000
  )
  @IsNumber()
  @Min(10)
  TASK_MASTER_TIMEOUT_MS?: number = 120_000;

  @IsOptional()
  @IsString()
  TASK_MASTER_STORAGE_PATH?: string;
}
