import { Injectable } from '@nestjs/common';

import { User } from './schemas/user.schema';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  /**
   * Find a user by their email.
   * @param {string} email - The email of the user we want to find
   * @returns A promise of a user
   */
  async findUserByEmail(email: string): Promise<User> {
    return this.usersRepository.findUserByEmail(email);
  }
}
