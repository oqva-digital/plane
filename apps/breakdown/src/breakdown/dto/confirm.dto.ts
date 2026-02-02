import { IsString, IsOptional, IsArray, ValidateNested, IsBoolean, IsObject, ArrayMinSize } from "class-validator";
import { Type } from "class-transformer";

export class TaskToCreateDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labels?: string[];

  @IsOptional()
  @IsString()
  temp_id?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dependencies?: string[];

  @IsOptional()
  @IsString()
  github_link?: string;

  @IsOptional()
  @IsString()
  agent?: string;
}

export class ConfirmOptionsDto {
  @IsOptional()
  @IsBoolean()
  link_to_parent?: boolean;

  @IsOptional()
  @IsBoolean()
  set_parent_as_epic?: boolean;
}

export class ConfirmRequestDto {
  @IsString()
  workspace_slug!: string;

  @IsString()
  project_id!: string;

  @IsString()
  parent_work_item_id!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TaskToCreateDto)
  tasks_to_create!: TaskToCreateDto[];

  @IsOptional()
  @IsObject()
  @Type(() => ConfirmOptionsDto)
  options?: ConfirmOptionsDto;
}
