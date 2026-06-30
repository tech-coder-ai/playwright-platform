import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getDashboard(
    @Query('projectId') projectId?: string,
    @Query('runLimit') runLimit?: string,
  ) {
    const limit = runLimit ? Math.min(Math.max(parseInt(runLimit, 10) || 20, 5), 50) : 20;
    return this.dashboardService.getDashboard(projectId || undefined, limit);
  }
}
