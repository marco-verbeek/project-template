import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '@prisma/client';
import * as argon2 from 'argon2';

import { getUserMock } from '../../common/mocks/entities/user.mock';
import { getMockConfigService } from '../../common/mocks/services/config-service.mock';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth.service';

describe('AuthService', () => {
  let authService: AuthService;
  let prismaService: PrismaService;

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

        {
          provide: PrismaService,
          useValue: {
            user: {
              create: jest.fn(),
              update: jest.fn(),
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    authService = moduleRef.get<AuthService>(AuthService);
    prismaService = moduleRef.get<PrismaService>(PrismaService);
  });

  beforeEach(() => {
    user = getUserMock();
  });

  it('should have defined dependencies', () => {
    expect(authService).toBeDefined();
  });

  describe('local registration', () => {
    it('should successfully register a user', async () => {
      jest.spyOn(prismaService.user, 'create').mockResolvedValueOnce(user);

      const registerReq = await authService.localRegister({
        email: user.email,
        password: user.password,
      });

      expect(registerReq).toBeDefined();
      expect(registerReq).toHaveProperty('accessToken');
      expect(registerReq).toHaveProperty('refreshToken');
    });

    it('should throw an error if email already exists', async () => {
      jest.spyOn(prismaService.user, 'create').mockRejectedValueOnce({});

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
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce(null);

      expect(() =>
        authService.localLogin({
          email: user.email,
          password: user.password,
        }),
      ).rejects.toThrowError(ForbiddenException);
    });

    it('should log the user in if password matches', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce({
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
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce({
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
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce(null);

      expect(() =>
        authService.refreshTokens(12345, 'refreshToken'),
      ).rejects.toThrowError(ForbiddenException);
    });

    it('should throw if the user is logged out', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce({
        ...user,
        hashedRefreshToken: null,
      });

      expect(() =>
        authService.refreshTokens(12345, 'refreshToken'),
      ).rejects.toThrowError(ForbiddenException);
    });

    it('should throw if the refresh token is incorrect', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce({
        ...user,
        hashedRefreshToken: await argon2.hash('random-string'),
      });

      expect(() =>
        authService.refreshTokens(12345, 'refreshToken'),
      ).rejects.toThrowError(ForbiddenException);
    });

    it("should refresh the user's tokens", async () => {
      const refreshToken = 'rt-string';
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce({
        ...user,
        hashedRefreshToken: await argon2.hash(refreshToken),
      });

      const refreshReq = await authService.refreshTokens(user.id, refreshToken);

      expect(refreshReq).toBeDefined();
      expect(refreshReq).toHaveProperty('accessToken');
      expect(refreshReq).toHaveProperty('refreshToken');
    });
  });
});
