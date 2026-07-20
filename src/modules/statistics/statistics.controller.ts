import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StatisticsService } from './statistics.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('statistics')
@ApiBearerAuth()
@Roles(Role.Admin, Role.Supervisor)
@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('overview')
  overview() {
    return this.statisticsService.overview();
  }

  @Get('by-clinic')
  byClinic() {
    return this.statisticsService.byClinic();
  }

  @Get('timeseries')
  timeseries(@Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number) {
    return this.statisticsService.timeseries(days);
  }
}
