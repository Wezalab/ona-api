import { Module } from '@nestjs/common';
import { StarknetService } from './starknet.service';
import { BlockchainController } from './blockchain.controller';

@Module({
  providers: [StarknetService],
  controllers: [BlockchainController],
  exports: [StarknetService],
})
export class BlockchainModule {}
