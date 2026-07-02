import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/auth.decorators';
import { getDatabaseProviderLabel } from './database/database.factory';
import { getBrowserProvider } from './common/browser-env.util';

@Controller()
export class AppController {
  @Public()
  @Get('health')
  health() {
    return {
      status: 'ok',
      database: getDatabaseProviderLabel(),
      browser: getBrowserProvider(),
    };
  }
}
