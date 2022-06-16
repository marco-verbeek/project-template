import { registerUserDTO } from './dtos/register-user.dto';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Model, Types } from 'mongoose';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  createUser(registrationData: registerUserDTO): Promise<User> {
    return this.userModel.create({
      ...registrationData,
      _id: new Types.ObjectId(),
    });
  }

  updateUserRefreshToken(userId: string, refreshToken: string) {
    return this.userModel
      .updateOne(
        { _id: new Types.ObjectId(userId) },
        { $set: { hashedRefreshToken: refreshToken } },
      )
      .exec();
  }

  findUserById(userId: string): Promise<User> {
    return this.userModel.findById(new Types.ObjectId(userId)).exec();
  }

  findUserByEmail(email: string): Promise<User> {
    return this.userModel.findOne({ email }).exec();
  }

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
