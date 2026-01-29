import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { HttpModule } from "@nestjs/axios";
import { PlaneClient } from "./plane.client";

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        baseURL: config.getOrThrow<string>("PLANE_API_URL"),
        headers: {
          "X-API-Key": config.getOrThrow<string>("PLANE_API_KEY"),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [PlaneClient],
  exports: [PlaneClient],
})
export class PlaneModule {}
