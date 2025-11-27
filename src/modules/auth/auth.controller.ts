import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiCookieAuth,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { type Request, type Response } from 'express';
import { AuthService } from './auth.service';
import {
  registerSchema,
  loginSchema,
  type RegisterDto,
  type LoginDto,
} from './dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Registrar novo usuário',
    description:
      'Cria uma nova conta de usuário e retorna tokens de autenticação via cookies HttpOnly. O usuário é criado com saldo inicial de R$ 0,00.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'email', 'password'],
      properties: {
        name: {
          type: 'string',
          description: 'Nome completo do usuário',
          example: 'João Silva',
          minLength: 1,
        },
        email: {
          type: 'string',
          format: 'email',
          description: 'Email único do usuário',
          example: 'joao.silva@example.com',
        },
        password: {
          type: 'string',
          description: 'Senha com mínimo de 8 caracteres',
          example: 'senha@123',
          minLength: 8,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Usuário registrado com sucesso. Tokens enviados via cookies.',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'uuid-v4' },
            name: { type: 'string', example: 'João Silva' },
            email: { type: 'string', example: 'joao.silva@example.com' },
            balance: { type: 'string', example: '0.00' },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-15T10:30:00Z',
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Email já cadastrado',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 409 },
        message: { type: 'string', example: 'Email já cadastrado' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'array',
          items: { type: 'string' },
          example: ['Email inválido', 'Senha deve ter no mínimo 8 caracteres'],
        },
      },
    },
  })
  async register(
    @Body(new ZodValidationPipe(registerSchema)) registerDto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(registerDto);

    response.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    response.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return { user: result.user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Autenticar usuário',
    description:
      'Autentica um usuário existente e retorna tokens via cookies HttpOnly. Tokens incluem accessToken (15min) e refreshToken (7 dias).',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: {
          type: 'string',
          format: 'email',
          description: 'Email do usuário',
          example: 'joao.silva@example.com',
        },
        password: {
          type: 'string',
          description: 'Senha do usuário',
          example: 'senha@123',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Login realizado com sucesso. Tokens enviados via cookies.',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'uuid-v4' },
            name: { type: 'string', example: 'João Silva' },
            email: { type: 'string', example: 'joao.silva@example.com' },
            balance: { type: 'string', example: '1000.50' },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-15T10:30:00Z',
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Credenciais inválidas',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Credenciais inválidas' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'array',
          items: { type: 'string' },
          example: ['Email inválido'],
        },
      },
    },
  })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(loginDto);

    response.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    response.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return { user: result.user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renovar token de acesso',
    description:
      'Renova o accessToken usando o refreshToken armazenado em cookie. Retorna novo accessToken via cookie HttpOnly.',
  })
  @ApiCookieAuth('refreshToken')
  @ApiResponse({
    status: 200,
    description: 'Token renovado com sucesso. Novo accessToken enviado via cookie.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Refresh token inválido ou não fornecido',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: {
          type: 'string',
          example: 'Refresh token não fornecido',
        },
      },
    },
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies['refreshToken'];

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token não fornecido');
    }

    const result = await this.authService.refreshAccessToken(refreshToken);

    response.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    return { success: true };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Encerrar sessão',
    description:
      'Invalida o refreshToken do usuário e limpa os cookies de autenticação. Requer autenticação via JWT.',
  })
  @ApiCookieAuth('accessToken')
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({
    status: 204,
    description: 'Logout realizado com sucesso. Cookies removidos.',
  })
  @ApiResponse({
    status: 401,
    description: 'Não autenticado',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  async logout(
    @CurrentUser() user: any,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies['refreshToken'];

    if (refreshToken) {
      await this.authService.logout(user.id, refreshToken);
    }

    response.clearCookie('accessToken');
    response.clearCookie('refreshToken');
  }
}
