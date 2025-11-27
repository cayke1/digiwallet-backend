import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiCookieAuth,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Obter dados do usuário autenticado',
    description:
      'Retorna os dados do usuário autenticado, incluindo saldo atual. Requer autenticação via JWT.',
  })
  @ApiCookieAuth('accessToken')
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({
    status: 200,
    description: 'Dados do usuário retornados com sucesso',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'uuid-v4' },
        name: { type: 'string', example: 'João Silva' },
        email: { type: 'string', example: 'joao.silva@example.com' },
        balance: {
          type: 'string',
          description: 'Saldo em formato decimal (precisão de 2 casas)',
          example: '1500.75',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          example: '2025-01-15T10:30:00Z',
        },
      },
    },
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
  @ApiResponse({
    status: 404,
    description: 'Usuário não encontrado',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Usuário não encontrado' },
      },
    },
  })
  async getMe(@CurrentUser() user: any) {
    return this.usersService.findById(user.id);
  }

  @Get('/email')
  @ApiOperation({
    summary: 'Buscar usuário por email',
    description:
      'Retorna os dados públicos de um usuário através do seu email. Útil para validar destinatários em transferências.',
  })
  @ApiQuery({
    name: 'email',
    type: String,
    description: 'Email do usuário a ser buscado',
    example: 'maria.santos@example.com',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Usuário encontrado com sucesso',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'uuid-v4' },
        name: { type: 'string', example: 'Maria Santos' },
        email: { type: 'string', example: 'maria.santos@example.com' },
        balance: {
          type: 'string',
          description: 'Saldo em formato decimal',
          example: '2000.00',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          example: '2025-01-10T08:15:00Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Usuário não encontrado',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Usuário não encontrado' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Email não fornecido',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Email é obrigatório' },
      },
    },
  })
  async getByEmail(@Query() identifier: any) {
    return this.usersService.findByEmail(identifier.email);
  }
}
