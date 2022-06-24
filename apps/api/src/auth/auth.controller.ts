import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { GetCurrentUserId } from '../common/decorators/get-current-user-id.decorator';
import { GetCurrentUser } from '../common/decorators/get-current-user.decorator';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { RefreshTokenGuard } from '../common/guards/refresh-token.guard';
import { AuthService } from './auth.service';
import { AuthDTO } from './dtos/auth.dto';
import { RegisterUserDTO } from './dtos/register-user.dto';
import { Tokens } from './types/tokens.type';

@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('/local/register')
  @ApiOperation({ summary: 'Register a new user using the local strategy.' })
  @ApiCreatedResponse({
    description: 'The user has successfully been registered.',
  })
  @ApiBadRequestResponse({
    description: 'A user with this email address already exists.',
  })
  @ApiBadRequestResponse({
    description: 'Could not create account.',
  })
  @HttpCode(HttpStatus.CREATED)
  localRegister(@Body() registrationData: RegisterUserDTO): Promise<Tokens> {
    return this.authService.localRegister(registrationData);
  }

  @Post('/local/login')
  @ApiOperation({
    summary: 'Log the user in by providing an email and password.',
  })
  @ApiOkResponse({
    description: 'Successfully authenticated the user.',
    type: Tokens,
  })
  @ApiForbiddenResponse({
    description: 'Access denied: invalid email or password.',
  })
  @HttpCode(HttpStatus.OK)
  localLogin(@Body() authData: AuthDTO): Promise<Tokens> {
    return this.authService.localLogin(authData);
  }

  @Post('/logout')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Log the user out by deleting their refresh token.',
  })
  @ApiNoContentResponse({
    description: "Successfully deleted the user's refresh token.",
  })
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@GetCurrentUserId() userId: string) {
    return this.authService.logout(userId);
  }

  @Post('/refresh')
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Refresh the user's tokens by using their refresh token.",
  })
  @ApiOkResponse({
    description: "Successfully refreshed the user's tokens.",
    type: Tokens,
  })
  @ApiForbiddenResponse({ description: 'Access denied: invalid token' })
  @UseGuards(RefreshTokenGuard)
  @HttpCode(HttpStatus.OK)
  refreshTokens(
    @GetCurrentUserId() userId: string,
    @GetCurrentUser('refreshToken') refreshToken: string,
  ) {
    return this.authService.refreshTokens(userId, refreshToken);
  }
}
