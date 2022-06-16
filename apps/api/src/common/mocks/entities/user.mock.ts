import { Types } from 'mongoose';

import { User } from './../../../auth/schemas/user.schema';

export const getUserMock = (): User => {
  return {
    _id: new Types.ObjectId(),
    email: 'user.mock@example.com',
    password: 'plain-text-pw',
  };
};
