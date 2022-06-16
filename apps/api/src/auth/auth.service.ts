import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

import { AuthDTO } from './dtos/auth.dto';
import { Tokens } from './types/tokens.type';
import { UsersRepository } from './users.repository';

@Injectable()
export class AuthService {
  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
    private usersRepository: UsersRepository,
  ) {}

  async localRegister(authData: AuthDTO): Promise<Tokens> {
    const hashedPassword = await this.hashData(authData.password);

    try {
      const user = await this.usersRepository.createUser({
        ...authData,
        password: hashedPassword,
      });

      const tokens = await this.getTokens(user._id.toString(), user.email);
      await this.usersRepository.updateUserRefreshToken(
        user._id.toString(),
        await this.hashData(tokens.refreshToken),
      );

      return tokens;
    } catch (err) {
      if (err.code === 11000) {
        throw new BadRequestException(
          'A user with this email address already exists',
        );
      }

      throw new BadRequestException('Could not create account');
    }
  }

  async localLogin(authData: AuthDTO): Promise<Tokens> {
    const user = await this.usersRepository.findUserByEmail(authData.email);
    if (!user) throw new ForbiddenException('Access denied');

    const passwordMatches = await argon2.verify(
      user.password,
      authData.password,
    );
    if (!passwordMatches) throw new ForbiddenException('Access denied');

    const tokens = await this.getTokens(user._id.toString(), user.email);
    await this.usersRepository.updateUserRefreshToken(
      user._id.toString(),
      await this.hashData(tokens.refreshToken),
    );

    return tokens;
  }

  async logout(userId: string) {
    await this.usersRepository.deleteUserRefreshToken(userId);
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.usersRepository.findUserById(userId);
    if (!user || !user.hashedRefreshToken)
      throw new ForbiddenException('Access denied');

    const tokenMatches = await argon2.verify(
      user.hashedRefreshToken,
      refreshToken,
    );
    if (!tokenMatches) throw new ForbiddenException('Access denied');

    const tokens = await this.getTokens(user._id.toString(), user.email);
    await this.usersRepository.updateUserRefreshToken(
      user._id.toString(),
      await this.hashData(tokens.refreshToken),
    );

    return tokens;
  }

  async hashData(data: string) {
    return argon2.hash(data);
  }

  async getTokens(userId: string, email: string) {
    const accessToken = await this.jwtService.signAsync(
      {
        sub: userId,
        email,
      },
      {
        secret: this.configService.get('ACCESS_TOKEN_SECRET'),
        expiresIn: this.configService.get('ACCESS_TOKEN_EXPIRATION'),
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: userId,
        email,
      },
      {
        secret: this.configService.get('REFRESH_TOKEN_SECRET'),
        expiresIn: this.configService.get('REFRESH_TOKEN_EXPIRATION'),
      },
    );

    return { accessToken, refreshToken };
  }
}
