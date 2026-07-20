import { Logger as NestLogger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Structured logging via pino
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService<AppConfig, true>);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.get('corsOrigins', { infer: true }), credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger / OpenAPI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ONA Eye Health API')
    .setDescription(
      'REST API for the ONA mobile app. Persists screenings in MongoDB and anchors ' +
        'anonymized statistics to the StarkNet ImpactRegistry. The public website reads ' +
        'dashboards directly from the blockchain — never from this database.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get('port', { infer: true });
  await app.listen(port);
  new NestLogger('Bootstrap').log(`ONA API listening on :${port} (docs at /docs)`);
}

bootstrap();
