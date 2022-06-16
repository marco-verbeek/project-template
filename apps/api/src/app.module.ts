import { MiddlewareConsumer, Module } from '@nestjs/common';
import LoggerMiddleware from './middlewares/logger.middleware';

@Module({})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
