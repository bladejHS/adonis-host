import "reflect-metadata";
import { pathToFileURL } from "node:url";
import { Module } from "@nestjs/common";
import { APP_GUARD, NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AuthGuard } from "./common";
import { Scheduler } from "./scheduler";
import { AuthController } from "./modules/auth.controller";
import { ReservationsController } from "./modules/reservations.controller";
import { SyncController, TemplatesController } from "./modules/sync.controller";
import { GuestController } from "./modules/guest.controller";
import { HousekeepingController } from "./modules/housekeeping.controller";
import { FinanceController, HealthController, WebhooksController } from "./modules/finance.controller";

@Module({
  controllers: [HealthController, AuthController, ReservationsController, SyncController, TemplatesController, GuestController, HousekeepingController, FinanceController, WebhooksController],
  providers: [Scheduler, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}

export function openApiConfig() {
  return new DocumentBuilder()
    .setTitle("Adonis Host API")
    .setDescription("API-ul Hostelului Adonis Costinești: rezervări, calendar, sincronizare canale, șabloane mesaje, check-in online, curățenie, financiar.")
    .setVersion("1.0")
    .addBearerAuth()
    .addServer(process.env.API_BASE_URL ?? "http://localhost:4000")
    .build();
}

export async function createApp() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true, logger: ["log", "warn", "error"] });
  app.useBodyParser("json", { limit: "15mb" }); // poze acte și daune trimise ca data URL
  app.enableCors({ origin: (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:3001").split(","), credentials: true });
  return app;
}

async function bootstrap() {
  const app = await createApp();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, openApiConfig()), { customSiteTitle: "Adonis Host API" });
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  console.log(`API Adonis pornit pe http://localhost:${port} · documentație: /docs`);
}

// pornește serverul doar când fișierul e rulat direct (nu la exportul OpenAPI)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void bootstrap();
