import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*',
    credentials: true,
  });

  const port = process.env.MOVIE_SERVICE_PORT || 5003;
  await app.listen(port);
}

bootstrap();
