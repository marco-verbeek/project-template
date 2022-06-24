import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginUserDTO {
  @ApiProperty({ example: 'user@project.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Project123!' })
  @IsNotEmpty()
  @IsString()
  password: string;
}
