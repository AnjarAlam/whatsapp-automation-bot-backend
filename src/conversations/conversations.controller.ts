import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WhatsappService } from '../whatsapp/services/whatsapp.service';
import { MessageDirection, MessageStatus } from './schemas/message.schema';

@ApiTags('Chat & Conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly whatsappService: WhatsappService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all chat conversations for logged-in admin' })
  async getConversations(@CurrentUser('_id') userId: string) {
    return this.conversationsService.getConversations(userId);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get message history for a specific conversation' })
  async getMessages(
    @CurrentUser('_id') userId: string,
    @Param('id') id: string,
  ) {
    return this.conversationsService.getMessages(userId, id);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a manual WhatsApp reply message to customer' })
  @ApiResponse({ status: 201, description: 'Message sent successfully' })
  async sendMessage(
    @CurrentUser('_id') userId: string,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    const conversation = await this.conversationsService.findConversationById(
      userId,
      id,
    );

    const customerMobile = (conversation.customerId as any).mobile;

    // Send via WhatsApp socket
    const success = await this.whatsappService.sendMessage(
      userId.toString(),
      customerMobile,
      dto.message,
      dto.imageUrl,
    );

    const status = success ? MessageStatus.SENT : MessageStatus.FAILED;

    const savedMessage = await this.conversationsService.saveMessage(
      conversation._id,
      MessageDirection.OUTGOING,
      dto.message,
      status,
      undefined,
      dto.imageUrl,
    );


    return {
      message: savedMessage,
      whatsappSent: success,
    };
  }
}
