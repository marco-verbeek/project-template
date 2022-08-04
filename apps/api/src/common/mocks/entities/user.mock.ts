import { faker } from '@faker-js/faker';
import { User } from '@prisma/client';

export const getUserMock = (): User => {
  return {
    id: null,
    email: faker.internet.email(),
    password: faker.internet.password(),
    hashedRefreshToken: null,
  };
};
