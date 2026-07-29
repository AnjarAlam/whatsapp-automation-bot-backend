import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Flow, FlowSchema } from './schemas/flow.schema';
import { FlowsService } from './flows.service';
import { FlowsController } from './flows.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Flow.name, schema: FlowSchema }]),
  ],
  controllers: [FlowsController],
  providers: [FlowsService],
  exports: [FlowsService],
})
export class FlowsModule {}
