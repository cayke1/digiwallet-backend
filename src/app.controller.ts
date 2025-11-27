import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Health check',
    description:
      'Verifica se a API está funcionando corretamente. Endpoint público para monitoramento.',
  })
  @ApiResponse({
    status: 200,
    description: 'API está funcionando',
    schema: {
      type: 'string',
      example: 'DigiWallet API is running!',
    },
  })
  getHello(): string {
    return this.appService.getHello();
  }
}
