import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StarknetService } from './starknet.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('blockchain')
@ApiBearerAuth()
@Controller('blockchain')
export class BlockchainController {
  constructor(private readonly starknet: StarknetService) {}

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
}
