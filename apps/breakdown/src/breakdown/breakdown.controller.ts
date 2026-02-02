import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { ApiKeyGuard } from "../common/guards/api-key.guard";
import { BreakdownService } from "./breakdown.service";
import { BreakdownRequestDto } from "./dto/breakdown.dto";
import { ConfirmRequestDto } from "./dto/confirm.dto";
import { ExpandRequestDto } from "./dto/expand.dto";

@Controller()
@UseGuards(ApiKeyGuard)
export class BreakdownController {
  constructor(private readonly breakdown: BreakdownService) {}

  @Post("breakdown")
  async postBreakdown(@Body() dto: BreakdownRequestDto) {
    return this.breakdown.breakdown(dto);
  }

  @Post("breakdown/confirm")
  async postBreakdownConfirm(@Body() dto: ConfirmRequestDto) {
    return this.breakdown.confirm(dto);
  }

  @Post("breakdown/expand")
  async postExpand(@Body() dto: ExpandRequestDto) {
    return this.breakdown.expand(dto);
  }
}
