import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from './schemas/order.schema';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    forwardRef(() => require('../whatsapp/whatsapp.module').WhatsappModule),
    forwardRef(() => require('../conversations/conversations.module').ConversationsModule),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
