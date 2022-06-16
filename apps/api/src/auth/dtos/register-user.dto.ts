import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class registerUserDTO {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}
