import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnv } from "./config/env.validate";
import { BreakdownModule } from "./breakdown/breakdown.module";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        const env = validateEnv(config);
        return { ...env };
      },
    }),
    BreakdownModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
