import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // app.use(json({ limit: 100_000_000 }));
  // app.use(
  //   urlencoded({
  //     extended: true,
  //     limit: 100_000_000_000_000,
  //   }),
  // );

  // const server = app.getHttpServer();
  // const io = new socketio.Server(server, {
  //   cors: {
  //     origin: '*',
  //     methods: ['GET', 'POST'],
  //   },
  // });
  // app.useWebSocketAdapter(new IoAdapter(io));
  await app.listen(process.env.PORT ?? 8000);
}
bootstrap();
