import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WhatsAppSession, WhatsAppSessionSchema } from './schemas/whatsapp-session.schema';
import { WhatsappService } from './services/whatsapp.service';
import { IncomingMessageService } from './services/incoming-message.service';
import { WhatsappController } from './whatsapp.controller';
import { CustomersModule } from '../customers/customers.module';
import { FlowsModule } from '../flows/flows.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { UsersModule } from '../users/users.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WhatsAppSession.name, schema: WhatsAppSessionSchema },
    ]),
    CustomersModule,
    FlowsModule,
    UsersModule,
    OrdersModule,
    forwardRef(() => ConversationsModule),
  ],
  controllers: [WhatsappController],
  providers: [WhatsappService, IncomingMessageService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
