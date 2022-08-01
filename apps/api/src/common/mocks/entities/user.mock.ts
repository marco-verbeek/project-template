import { faker } from '@faker-js/faker';
import { Types } from 'mongoose';

import { User } from '../../../users/schemas/user.schema';

export const getUserMock = (): User => {
  return {
    _id: new Types.ObjectId().toString(),

    email: faker.internet.email(),
    password: faker.internet.password(),
  };
};
