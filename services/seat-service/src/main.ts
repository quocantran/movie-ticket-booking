import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const kafkaBroker = process.env.KAFKA_BROKER || 'localhost:9094';

  app.enableCors({ origin: '*', credentials: true });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'seat-service',
        brokers: [kafkaBroker],
      },
      consumer: {
        groupId: 'seat-service-group',
      },
    },
  });

  await app.startAllMicroservices();

  const port = process.env.SEAT_SERVICE_PORT || 5002;
  await app.listen(port);
}

bootstrap();
