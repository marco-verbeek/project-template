import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /**
   * It creates a new user using the provided registration data.
   * @param {string} email - the user's email
   * @param {string} password - the user's hashed password
   * @returns A promise that resolves to the created user
   */
  createUser({ email, password }): Promise<User> {
    return this.userModel.create({
      _id: new Types.ObjectId(),
      email,
      password,
    });
  }

  /**
   * It updates the user's refresh token in the database.
   * @param {string} userId - The user's id
   * @param {string} refreshToken - The user's refresh token
   */
  updateUserRefreshToken(userId: string, refreshToken: string) {
    return this.userModel
      .updateOne(
        { _id: new Types.ObjectId(userId) },
        { $set: { hashedRefreshToken: refreshToken } },
      )
      .exec();
  }

  /**
   * Find a user by their id and return the user as a promise.
   * @param {string} userId - The id of the user we want to find
   * @returns A promise of a user
   */
  findUserById(userId: string): Promise<User> {
    return this.userModel.findById(new Types.ObjectId(userId)).exec();
  }

  /**
   * Find a user by email and return the user as a promise.
   * @param {string} email - The email of the user we want to find
   * @returns A promise of a user
   */
  findUserByEmail(email: string): Promise<User> {
    return this.userModel.findOne({ email }).exec();
  }

  /**
   * It deletes the user's refresh token from the database.
   * @param {string} userId - The user's id
   */
  async deleteUserRefreshToken(userId: string) {
    await this.userModel
      .updateOne(
        {
          _id: new Types.ObjectId(userId),
          hashedRefreshToken: { $ne: null },
        },
        { hashedRefreshToken: null },
      )
      .exec();
  }
}
