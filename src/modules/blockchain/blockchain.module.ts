import { forwardRef, Module } from '@nestjs/common';
import { StarknetService } from './starknet.service';
import { BlockchainController } from './blockchain.controller';
import { ScreeningsModule } from '../screenings/screenings.module';

@Module({
  imports: [forwardRef(() => ScreeningsModule)],
  providers: [StarknetService],
  controllers: [BlockchainController],
  exports: [StarknetService],
})
export class BlockchainModule {}
