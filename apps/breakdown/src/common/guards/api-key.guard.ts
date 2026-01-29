import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

interface RequestWithHeaders {
  headers: Record<string, string | string[] | undefined>;
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithHeaders>();
    const key =
      req.headers["x-breakdown-api-key"] ??
      (() => {
        const auth = req.headers.authorization;
        if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
          return auth.slice(7).trim();
        }
        return undefined;
      })();
    const expected = this.config.get<string>("BREAKDOWN_API_KEY");
    if (!expected || key !== expected) {
      throw new UnauthorizedException("Invalid or missing API key");
    }
    return true;
  }
}
