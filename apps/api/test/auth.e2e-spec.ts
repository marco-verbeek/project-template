import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import mongoose, { Connection } from 'mongoose';
import * as request from 'supertest';

import { AuthModule } from '../src/auth/auth.module';
import { getUserMock } from '../src/common/mocks/entities/user.mock';
import { getMockConfigService } from '../src/common/mocks/services/config-service.mock';
import { User } from '../src/users/schemas/user.schema';
import {
  closeInMemMongoConnection,
  inMemMongooseTestModule,
} from './utils/in-mem-mongo';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let connection: Connection;

  let jwtService: JwtService;
  let configService: ConfigService;

  let userModel: mongoose.Model<User>;
  let userMock: User;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [inMemMongooseTestModule(), AuthModule],
      providers: [{ provide: ConfigService, useValue: getMockConfigService() }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());

    await app.init();

    connection = await app.get(getConnectionToken());

    jwtService = app.get<JwtService>(JwtService);
    configService = app.get<ConfigService>(ConfigService);

    userModel = await app.get(getModelToken(User.name));
    userMock = getUserMock();
  });

  afterEach(async () => {
    await connection.close();
    await closeInMemMongoConnection();
  });

  const genAccessToken = async (userId: string, email: string) => {
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

  const genRefreshToken = async (userId: string, email: string) => {
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
      const req = await request(app.getHttpServer())
        .post('/auth/local/register')
        .send(userMock);

      expect(req.body.accessToken).toBeDefined();
      expect(req.body.refreshToken).toBeDefined();

      const user: User = await userModel.findOne({ email: userMock.email });
      expect(user).toBeDefined();

      await expect(
        argon2.verify(user.hashedRefreshToken, req.body.refreshToken),
      ).resolves.toBe(true);

      // TODO: decode tokens and make sure they contain the correct payload.
    });

    it('should fail registration when provided incorrect arguments', async () => {
      const req = await request(app.getHttpServer())
        .post('/auth/local/register')
        .send({});

      expect(req.body.statusCode).toBe(400);
      expect(req.body.message).toEqual([
        'email must be an email',
        'password must be a string',
        'password should not be empty',
      ]);
    });

    it('should fail registration when provided email is already in use', async () => {
      // Add a user with the same email address in the database
      await userModel.create({
        ...userMock,
      });

      const req = await request(app.getHttpServer())
        .post('/auth/local/register')
        .send({ email: userMock.email, password: 'test-password' });

      expect(req.body.statusCode).toBe(400);
      expect(req.body.message).toBe(
        'A user with this email address already exists',
      );
    });
  });

  describe('Logging in', () => {
    it('should log the user in successfully', async () => {
      await userModel.create({
        ...userMock,
        password: await argon2.hash(userMock.password),
      });

      const req = await request(app.getHttpServer())
        .post('/auth/local/login')
        .send(userMock);

      expect(req.statusCode).toBe(200);
      expect(req.body.accessToken).toBeDefined();
      expect(req.body.refreshToken).toBeDefined();

      const user: User = await userModel.findOne({ email: userMock.email });
      expect(user).toBeDefined();

      await expect(
        argon2.verify(user.hashedRefreshToken, req.body.refreshToken),
      ).resolves.toBe(true);

      // TODO: un-encode tokens and make sure they contain the correct payload.
    });

    it('should fail if the password does not match', async () => {
      await userModel.create({
        ...userMock,
        password: await argon2.hash(userMock.password),
      });

      const req = await request(app.getHttpServer())
        .post('/auth/local/login')
        .send({ ...userMock, password: 'incorrect-password' });

      expect(req.body.statusCode).toBe(403);
      expect(req.body.message).toBe('Access denied');
    });

    it('should fail if user not registered', async () => {
      const req = await request(app.getHttpServer())
        .post('/auth/local/login')
        .send(userMock);

      expect(req.body.statusCode).toBe(403);
      expect(req.body.message).toBe('Access denied');
    });
  });

  describe('Logging out', () => {
    it('should log the user out successfully', async () => {
      const refreshToken = await genRefreshToken(
        userMock._id.toString(),
        userMock.email,
      );

      await userModel.create({
        ...userMock,
        hashedRefreshToken: await argon2.hash(refreshToken),
      });

      const accessToken = await genAccessToken(
        userMock._id.toString(),
        userMock.email,
      );

      const req = await request(app.getHttpServer())
        .post('/auth/logout')
        .set({ Authorization: `Bearer ${accessToken}` })
        .send();

      expect(req.statusCode).toBe(204);

      const postLogoutUser = await userModel.findById(userMock._id).lean();
      expect(postLogoutUser.hashedRefreshToken).toBe(null);
    });

    it('should fail if no access token provided', async () => {
      const req = await request(app.getHttpServer())
        .post('/auth/logout')
        .send();

      expect(req.body.statusCode).toBe(401);
      expect(req.body.message).toBe('Unauthorized');
    });

    it('should fail if provided a refresh token', async () => {
      const refreshToken = await genRefreshToken(
        userMock._id.toString(),
        userMock.email,
      );

      await userModel.create({
        ...userMock,
        hashedRefreshToken: await argon2.hash(refreshToken),
      });

      const req = await request(app.getHttpServer())
        .post('/auth/logout')
        .set({ Authorization: `Bearer ${refreshToken}` })
        .send();

      expect(req.statusCode).toBe(401);
      expect(req.body.message).toBe('Unauthorized');
    });
  });

  describe('Refreshing tokens', () => {
    it('should refresh the tokens successfully', async () => {
      const refreshToken = await genRefreshToken(
        userMock._id.toString(),
        userMock.email,
      );

      await userModel.create({
        ...userMock,
        hashedRefreshToken: await argon2.hash(refreshToken),
      });

      const req = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set({ Authorization: `Bearer ${refreshToken}` })
        .send();

      expect(req.statusCode).toBe(200);

      const dbUser = await userModel.findById(userMock._id).lean();

      await expect(
        argon2.verify(dbUser.hashedRefreshToken, req.body.refreshToken),
      ).resolves.toBe(true);
    });

    it('should fail if the user in token does not exist in db', async () => {
      const refreshToken = await genRefreshToken(
        userMock._id.toString(),
        userMock.email,
      );

      const req = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set({ Authorization: `Bearer ${refreshToken}` })
        .send();

      expect(req.statusCode).toBe(403);
      expect(req.body.message).toBe('Access denied');
    });

    it('should fail if no refresh token provided', async () => {
      const refreshToken = await genRefreshToken(
        userMock._id.toString(),
        userMock.email,
      );

      await userModel.create({
        ...userMock,
        hashedRefreshToken: await argon2.hash(refreshToken),
      });

      const req = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send();

      expect(req.statusCode).toBe(401);
      expect(req.body.message).toBe('Unauthorized');
    });

    it('should fail if provided an access token', async () => {
      const refreshToken = await genRefreshToken(
        userMock._id.toString(),
        userMock.email,
      );

      await userModel.create({
        ...userMock,
        hashedRefreshToken: await argon2.hash(refreshToken),
      });

      const accessToken = await genAccessToken(
        userMock._id.toString(),
        userMock.email,
      );

      const req = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set({ Authorization: `Bearer ${accessToken}` })
        .send();

      expect(req.statusCode).toBe(401);
      expect(req.body.message).toBe('Unauthorized');
    });
  });
});
