import * as argon2 from 'argon2';

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthService } from '../auth.service';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { User } from '../schemas/user.schema';
import { UsersRepository } from './../users.repository';
import { getMockConfigService } from '../../common/mocks/services/config-service.mock';
import { getUserMock } from '../../common/mocks/entities/user.mock';

describe('AuthService', () => {
  let authService: AuthService;
  let usersRepository: UsersRepository;

  let user: User;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      providers: [
        // Inject the main service we're testing.
        AuthService,

        // AuthService requires a ConfigService, which it uses for JWT secrets.
        {
          provide: ConfigService,
          useValue: getMockConfigService(),
        },

        // AuthService requires a usersRepository, which acts as a database for users.
        // This repository is mocked on-the-fly, depending on its use for each unique test.
        {
          provide: UsersRepository,
          useValue: {
            createUser: jest.fn(),
            updateUserRefreshToken: jest.fn(),
            findUserByEmail: jest.fn(),
            findUserById: jest.fn(),
          },
        },
      ],
    }).compile();

    authService = moduleRef.get<AuthService>(AuthService);
    usersRepository = moduleRef.get<UsersRepository>(UsersRepository);
  });

  beforeEach(() => {
    user = getUserMock();
  });

  it('should have defined dependencies', () => {
    expect(authService).toBeDefined();
    expect(usersRepository).toBeDefined();
  });

  describe('local registration', () => {
    it('should successfully register a user', async () => {
      jest.spyOn(usersRepository, 'createUser').mockResolvedValueOnce(user);

      const registerReq = await authService.localRegister({
        email: user.email,
        password: user.password,
      });

      expect(registerReq).toBeDefined();
      expect(registerReq).toHaveProperty('accessToken');
      expect(registerReq).toHaveProperty('refreshToken');
    });

    it('should throw an error if email already exists', async () => {
      jest
        .spyOn(usersRepository, 'createUser')
        .mockRejectedValueOnce({ code: 11000 });

      expect(() =>
        authService.localRegister({
          email: user.email,
          password: user.password,
        }),
      ).rejects.toThrowError(BadRequestException);
    });
  });

  describe('local login', () => {
    it('should throw if user does not exist', async () => {
      jest
        .spyOn(usersRepository, 'findUserByEmail')
        .mockResolvedValueOnce(null);

      expect(() =>
        authService.localLogin({
          email: user.email,
          password: user.password,
        }),
      ).rejects.toThrowError(ForbiddenException);
    });

    it('should log the user in if password matches', async () => {
      jest.spyOn(usersRepository, 'findUserByEmail').mockResolvedValueOnce({
        ...user,
        password: await argon2.hash(user.password),
      });

      const loginReq = await authService.localLogin({
        email: user.email,
        password: user.password,
      });

      expect(loginReq).toBeDefined();
      expect(loginReq).toHaveProperty('accessToken');
      expect(loginReq).toHaveProperty('refreshToken');
    });

    it('should throw an error if the password does not match', async () => {
      jest.spyOn(usersRepository, 'findUserByEmail').mockResolvedValueOnce({
        ...user,
        password: await argon2.hash(user.password),
      });

      expect(() =>
        authService.localLogin({
          email: user.email,
          password: 'incorrect-password',
        }),
      ).rejects.toThrowError(ForbiddenException);
    });
  });

  describe('refresh', () => {
    it('should throw if the user does not exist', async () => {
      jest.spyOn(usersRepository, 'findUserById').mockResolvedValueOnce(null);

      expect(() =>
        authService.refreshTokens('userId', 'refreshToken'),
      ).rejects.toThrowError(ForbiddenException);
    });

    it('should throw if the user is logged out', async () => {
      jest.spyOn(usersRepository, 'findUserById').mockResolvedValueOnce({
        ...user,
        hashedRefreshToken: null,
      });

      expect(() =>
        authService.refreshTokens('userId', 'refreshToken'),
      ).rejects.toThrowError(ForbiddenException);
    });

    it('should throw if the refresh token is incorrect', async () => {
      jest.spyOn(usersRepository, 'findUserById').mockResolvedValueOnce({
        ...user,
        hashedRefreshToken: await argon2.hash('random-string'),
      });

      expect(() =>
        authService.refreshTokens('userId', 'refreshToken'),
      ).rejects.toThrowError(ForbiddenException);
    });

    it("should refresh the user's tokens", async () => {
      const refreshToken = 'rt-string';
      jest.spyOn(usersRepository, 'findUserById').mockResolvedValueOnce({
        ...user,
        hashedRefreshToken: await argon2.hash(refreshToken),
      });

      const refreshReq = await authService.refreshTokens(
        user._id.toString(),
        refreshToken,
      );
      expect(refreshReq).toBeDefined();
      expect(refreshReq).toHaveProperty('accessToken');
      expect(refreshReq).toHaveProperty('refreshToken');
    });
  });
});
