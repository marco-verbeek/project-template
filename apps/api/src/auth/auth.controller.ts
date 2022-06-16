import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';

import { GetCurrentUserId } from '../common/decorators/get-current-user-id.decorator';
import { GetCurrentUser } from '../common/decorators/get-current-user.decorator';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { RefreshTokenGuard } from '../common/guards/refresh-token.guard';
import { AuthService } from './auth.service';
import { AuthDTO } from './dtos/auth.dto';
import { Tokens } from './types/tokens.type';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('/local/register')
  @HttpCode(HttpStatus.CREATED)
  localRegister(@Body() authData: AuthDTO): Promise<Tokens> {
    return this.authService.localRegister(authData);
  }

  @Post('/local/login')
  @HttpCode(HttpStatus.OK)
  localLogin(@Body() authData: AuthDTO): Promise<Tokens> {
    return this.authService.localLogin(authData);
  }

  @Post('/logout')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.OK)
  logout(@GetCurrentUserId() userId: string) {
    return this.authService.logout(userId);
  }

  @Post('/refresh')
  @UseGuards(RefreshTokenGuard)
  @HttpCode(HttpStatus.OK)
  refreshTokens(
    @GetCurrentUserId() userId: string,
    @GetCurrentUser('refreshToken') refreshToken: string,
  ) {
    return this.authService.refreshTokens(userId, refreshToken);
  }
}
