import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Transform } from 'class-transformer';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema()
export class User {
  @Transform(value => value.toString())
  @Prop()
  _id: string;

  @Prop({ unique: true })
  email: string;

  @Prop()
  password: string;

  @Prop()
  hashedRefreshToken?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
