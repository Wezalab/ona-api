import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ScreeningsService } from './screenings.service';
import { CreateScreeningDto } from './dto/create-screening.dto';
import { SyncScreeningsDto } from './dto/sync-screenings.dto';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('screenings')
@ApiBearerAuth()
@Controller('screenings')
export class ScreeningsController {
  constructor(private readonly screeningsService: ScreeningsService) {}

  @Post()
  create(@Body() dto: CreateScreeningDto, @CurrentUser() user: AuthUser) {
    return this.screeningsService.create(dto, user);
  }

  @Post('sync')
  sync(@Body() dto: SyncScreeningsDto, @CurrentUser() user: AuthUser) {
    return this.screeningsService.sync(dto.screenings, user);
  }

  @Get()
  findAll(@Query() pagination: PaginationDto, @CurrentUser() user: AuthUser) {
    return this.screeningsService.findAll(pagination, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.screeningsService.findById(id, user);
  }

  @Get(':id/blockchain')
  blockchain(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.screeningsService.getBlockchainRef(id, user);
  }
}
