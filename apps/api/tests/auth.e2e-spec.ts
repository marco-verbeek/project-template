import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '@prisma/client';
import * as argon2 from 'argon2';
import * as request from 'supertest';

import { AuthModule } from '../src/auth/auth.module';
import { getUserMock } from '../src/common/mocks/entities/user.mock';
import { getMockConfigService } from '../src/common/mocks/services/config-service.mock';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Authentication (e2e)', () => {
  let app: INestApplication;

  let jwtService: JwtService;
  let configService: ConfigService;
  let prismaService: PrismaService;

  let userMock: User;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, AuthModule],
      providers: [{ provide: ConfigService, useValue: getMockConfigService() }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());

    await app.init();

    jwtService = app.get<JwtService>(JwtService);
    configService = app.get<ConfigService>(ConfigService);
    prismaService = app.get<PrismaService>(PrismaService);
  });

  // Close server
  afterAll(async () => {
    await app.close();
  });

  // Regenerate mocks
  beforeEach(() => {
    userMock = getUserMock();
  });

  // Delete entire db
  afterEach(async () => {
    await prismaService.user.deleteMany();
  });

  const genAccessToken = async (userId: number, email: string) => {
    return jwtService.signAsync(
      {
        sub: userId,
        email,
      },
      {
        secret: configService.get('ACCESS_TOKEN_SECRET'),
        expiresIn: configService.get('ACCESS_TOKEN_EXPIRATION'),
      },
    );
  };

  const genRefreshToken = async (userId: number, email: string) => {
    return jwtService.signAsync(
      {
        sub: userId,
        email,
      },
      {
        secret: configService.get('REFRESH_TOKEN_SECRET'),
        expiresIn: configService.get('REFRESH_TOKEN_EXPIRATION'),
      },
    );
  };

  describe('Registration', () => {
    it('should register a user successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/local/register')
        .send({ email: userMock.email, password: userMock.password });

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();

      const user = await prismaService.user.findUnique({
        where: { email: userMock.email },
      });

      expect(user).toBeDefined();
      expect(user.hashedRefreshToken).toBeDefined();

      await expect(
        argon2.verify(user.hashedRefreshToken, res.body.refreshToken),
      ).resolves.toBe(true);

      // TODO: decode tokens and make sure they contain the correct payload.
    });

    it('should fail registration when provided incorrect arguments', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/local/register')
        .send({});

      expect(res.body.statusCode).toBe(400);
      expect(res.body.message).toEqual([
        'email must be an email',
        'password must be a string',
        'password should not be empty',
      ]);
    });

    it('should fail registration when provided email is already in use', async () => {
      // Add a user with the same email address in the database
      await prismaService.user.create({ data: { ...userMock } });

      const res = await request(app.getHttpServer())
        .post('/auth/local/register')
        .send({ email: userMock.email, password: 'test-password' });

      expect(res.body.statusCode).toBe(400);
      expect(res.body.message).toBe('Could not create account');
    });
  });

  describe('Logging in', () => {
    it('should log the user in successfully', async () => {
      const hashedPassword = await argon2.hash(userMock.password);
      await prismaService.user.create({
        data: {
          id: userMock.id,
          email: userMock.email,
          password: hashedPassword,
        },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/local/login')
        .send(userMock);

      expect(res.statusCode).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();

      const user = await prismaService.user.findUnique({
        where: { email: userMock.email },
      });

      expect(user).toBeDefined();
      expect(user.hashedRefreshToken).toBeDefined();

      await expect(
        argon2.verify(user.hashedRefreshToken, res.body.refreshToken),
      ).resolves.toBe(true);

      // TODO: un-encode tokens and make sure they contain the correct payload.
    });

    it('should fail if the password does not match', async () => {
      const hashedPassword = await argon2.hash(userMock.password);
      await prismaService.user.create({
        data: {
          id: userMock.id,
          email: userMock.email,
          password: hashedPassword,
        },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/local/login')
        .send({ email: userMock.email, password: 'incorrect-password' });

      expect(res.body.statusCode).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    it('should fail if user not registered', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/local/login')
        .send({ email: userMock.email, password: userMock.password });

      expect(res.body.statusCode).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });
  });

  describe('Logging out', () => {
    it('should log the user out successfully', async () => {
      const accessToken = await genAccessToken(userMock.id, userMock.email);
      const refreshToken = await genRefreshToken(userMock.id, userMock.email);
      const hashedRefreshToken = await argon2.hash(refreshToken);

      await prismaService.user.create({
        data: {
          id: userMock.id,
          email: userMock.email,
          password: userMock.password,
          hashedRefreshToken,
        },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set({ Authorization: `Bearer ${accessToken}` })
        .send();

      expect(res.statusCode).toBe(204);

      const postLogoutUser = await prismaService.user.findUnique({
        where: { email: userMock.email },
      });

      expect(postLogoutUser.hashedRefreshToken).toBe(null);
    });

    it('should fail if no access token provided', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .send();

      expect(res.body.statusCode).toBe(401);
      expect(res.body.message).toBe('Unauthorized');
    });

    it('should fail if provided a refresh token', async () => {
      const refreshToken = await genRefreshToken(userMock.id, userMock.email);
      const hashedRefreshToken = await argon2.hash(refreshToken);

      await prismaService.user.create({
        data: {
          id: userMock.id,
          email: userMock.email,
          password: userMock.password,
          hashedRefreshToken,
        },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set({ Authorization: `Bearer ${refreshToken}` })
        .send();

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Unauthorized');
    });
  });

  describe('Refreshing tokens', () => {
    it('should refresh the tokens successfully', async () => {
      const refreshToken = await genRefreshToken(userMock.id, userMock.email);
      const hashedRefreshToken = await argon2.hash(refreshToken);

      await prismaService.user.create({
        data: {
          id: userMock.id,
          email: userMock.email,
          password: userMock.password,
          hashedRefreshToken,
        },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set({ Authorization: `Bearer ${refreshToken}` })
        .send();

      expect(res.statusCode).toBe(200);

      const dbUser = await prismaService.user.findUnique({
        where: { email: userMock.email },
      });

      expect(dbUser).toBeDefined();
      expect(dbUser.hashedRefreshToken).toBeDefined();

      await expect(
        argon2.verify(dbUser.hashedRefreshToken, res.body.refreshToken),
      ).resolves.toBe(true);
    });

    it('should fail if the user in token does not exist in db', async () => {
      const refreshToken = await genRefreshToken(userMock.id, userMock.email);

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set({ Authorization: `Bearer ${refreshToken}` })
        .send();

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    it('should fail if no refresh token provided', async () => {
      const refreshToken = await genRefreshToken(userMock.id, userMock.email);
      const hashedRefreshToken = await argon2.hash(refreshToken);

      await prismaService.user.create({
        data: {
          id: userMock.id,
          email: userMock.email,
          password: userMock.password,
          hashedRefreshToken,
        },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send();

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Unauthorized');
    });

    it('should fail if provided an access token', async () => {
      const accessToken = await genAccessToken(userMock.id, userMock.email);
      const refreshToken = await genRefreshToken(userMock.id, userMock.email);
      const hashedRefreshToken = await argon2.hash(refreshToken);

      await prismaService.user.create({
        data: {
          id: userMock.id,
          email: userMock.email,
          password: userMock.password,
          hashedRefreshToken,
        },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set({ Authorization: `Bearer ${accessToken}` })
        .send();

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Unauthorized');
    });
  });
});
