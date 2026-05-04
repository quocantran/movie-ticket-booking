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
        clientId: 'booking-service',
        brokers: [kafkaBroker],
      },
      consumer: {
        groupId: 'booking-service-group',
      },
    },
  });

  await app.startAllMicroservices();

  const port = process.env.BOOKING_SERVICE_PORT || 5001;
  await app.listen(port);
}

bootstrap();
