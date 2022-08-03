import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongo: MongoMemoryServer;

export const inMemMongooseTestModule = (options: MongooseModuleOptions = {}) =>
  MongooseModule.forRootAsync({
    useFactory: async () => {
      mongo = await MongoMemoryServer.create();

      return {
        uri: mongo.getUri(),
        ...options,
      };
    },
  });

export const closeInMemMongoConnection = async () => {
  if (mongo) await mongo.stop();
};
