import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [CustomersModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
