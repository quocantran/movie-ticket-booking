import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: '*', credentials: true });

  const port = process.env.GATEWAY_PORT || 8080;
  await app.listen(port);
}

bootstrap();
