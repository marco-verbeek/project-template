import { faker } from '@faker-js/faker';
import { User } from '@prisma/client';

export const getUserMock = (): User => {
  return {
    id: faker.datatype.number({ min: 10, max: 10000 }),
    email: faker.internet.email(),
    password: faker.internet.password(),
    hashedRefreshToken: null,
  };
};
