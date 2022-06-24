import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

import { AuthDTO } from './dtos/auth.dto';
import { RegisterUserDTO } from './dtos/register-user.dto';
import { Tokens } from './types/tokens.type';
import { UsersRepository } from './users.repository';

@Injectable()
export class AuthService {
  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
    private usersRepository: UsersRepository,
  ) {}

  /**
   * It creates a new user using the local strategy by creating the tokens and hashing the refresh token.
   * @param {RegisterUserDTO} registrationData - contains the data required for a local registration.
   * @returns the authentication tokens created for this user.
   */
  async localRegister(registrationData: RegisterUserDTO): Promise<Tokens> {
    const hashedPassword = await this.hashData(registrationData.password);

    try {
      const user = await this.usersRepository.createUser({
        ...registrationData,
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

  /**
   * It takes an email and password, finds the user in the database and checks if the password matches.
   * If it does, it returns a new set of authentication tokens for that user.
   * @param {AuthDTO} authData - contains the data required to authenticate the user.
   * @returns the new authentication tokens for this user.
   */
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

  /**
   * It deletes the user's refresh token from the database.
   * @param {string} userId - The user's id.
   */
  async logout(userId: string) {
    await this.usersRepository.deleteUserRefreshToken(userId);
  }

  /**
   * It takes a userId and a refreshToken, finds the user in the database, verifies that the refreshToken
   * matches the one stored in the database, and if it does, it returns a new set of tokens.
   * @param {string} userId - The user's id
   * @param {string} refreshToken - The user's refresh token
   * @returns The new, refreshed tokens.
   */
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

  /**
   * It takes a string, hashes it, and returns the hash
   * @param {string} data - The data to be hashed.
   * @returns A promise that resolves to a string.
   */
  async hashData(data: string) {
    return argon2.hash(data);
  }

  /**
   * It signs a JWT with the user's id and email, and returns the access and refresh tokens
   * @param {string} userId - The user's id
   * @param {string} email - The user's email
   * @returns An object with two properties: the accessToken and refreshToken.
   */
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
