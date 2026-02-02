import { IsString, IsOptional, IsNumber, IsObject, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class ExpandOptionsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(20)
  max_subtasks?: number;

  @IsOptional()
  include_context_from_parent?: boolean;

  @IsOptional()
  @IsString()
  prompt?: string;
}

export class ExpandRequestDto {
  @IsString()
  work_item_id!: string;

  @IsString()
  workspace_slug!: string;

  @IsString()
  project_id!: string;

  @IsOptional()
  @IsObject()
  @Type(() => ExpandOptionsDto)
  options?: ExpandOptionsDto;
}
