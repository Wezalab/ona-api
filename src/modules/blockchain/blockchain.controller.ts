import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StarknetService } from './starknet.service';
import { AnchorService } from '../screenings/anchor.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('blockchain')
@ApiBearerAuth()
@Controller('blockchain')
export class BlockchainController {
  constructor(
    private readonly starknet: StarknetService,
    private readonly anchor: AnchorService,
  ) {}

  @Roles(Role.Admin, Role.Supervisor)
  @Get('status')
  status() {
    return this.starknet.getNetworkStatus();
  }

  @Roles(Role.Admin, Role.Supervisor)
  @Get('tx/:hash')
  txStatus(@Param('hash') hash: string) {
    return this.starknet.getTransactionStatus(hash);
  }

  @Roles(Role.Admin)
  @Post('retry-failed')
  @ApiOperation({
    summary: 'Reset failed screenings to pending and trigger a sweep',
    description:
      'Resets all screenings stuck in Failed state (MAX_ATTEMPTS reached) back to ' +
      'Pending and immediately triggers a sweep. Use after fixing an underlying RPC or gas issue.',
  })
  retryFailed() {
    return this.anchor.retryFailed();
  }
}
