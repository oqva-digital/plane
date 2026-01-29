import { IsString, IsOptional, IsNumber, IsObject, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class BreakdownOptionsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  max_tasks?: number;

  @IsOptional()
  @IsString()
  prompt?: string;
}

export class BreakdownRequestDto {
  @IsString()
  work_item_id!: string;

  @IsString()
  workspace_slug!: string;

  @IsString()
  project_id!: string;

  @IsOptional()
  @IsObject()
  @Type(() => BreakdownOptionsDto)
  options?: BreakdownOptionsDto;
}
