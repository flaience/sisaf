import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { DatabaseProvider } from './database/database.provider';

@Controller('health')
export class HealthController {
  constructor(
    private readonly database: DatabaseProvider,
  ) {}

  @Get()
  check() {
    return {
      status: 'ok',
      service: 'sisaf-api',
    };
  }

  @Get('ready')
  async ready() {
    const databaseReady =
      await this.database.checkConnection();

    if (!databaseReady) {
      throw new HttpException(
        {
          status: 'not_ready',
          service: 'sisaf-api',
          database: 'unavailable',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return {
      status: 'ready',
      service: 'sisaf-api',
      database: 'connected',
    };
  }
}
