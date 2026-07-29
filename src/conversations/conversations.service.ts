import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';
import { Message, MessageDirection, MessageDocument, MessageStatus } from './schemas/message.schema';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
  ) {}

  async findOrCreateConversation(
    userId: string | Types.ObjectId,
    customerId: string | Types.ObjectId,
  ): Promise<ConversationDocument> {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const customerObjId =
      typeof customerId === 'string' ? new Types.ObjectId(customerId) : customerId;

    let conv = await this.conversationModel
      .findOne({ userId: userObjId, customerId: customerObjId })
      .exec();

    if (!conv) {
      conv = await this.conversationModel.create({
        userId: userObjId,
        customerId: customerObjId,
      });
    }

    return conv;
  }

  async saveMessage(
    conversationId: string | Types.ObjectId,
    direction: MessageDirection,
    messageText: string,
    status: MessageStatus = MessageStatus.SENT,
    waMessageId?: string,
    imageUrl?: string,
  ): Promise<MessageDocument> {
    const convObjId =
      typeof conversationId === 'string'
        ? new Types.ObjectId(conversationId)
        : conversationId;

    const message = await this.messageModel.create({
      conversationId: convObjId,
      direction,
      message: messageText,
      status,
      waMessageId,
      imageUrl,
      timestamp: new Date(),
    });


    await this.conversationModel
      .findByIdAndUpdate(convObjId, {
        $set: {
          lastMessage: messageText,
          lastMessageAt: new Date(),
        },
      })
      .exec();

    return message;
  }

  async getConversations(userId: string | Types.ObjectId) {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    return this.conversationModel
      .find({ userId: userObjId })
      .populate('customerId', 'name mobile email tags')
      .sort({ lastMessageAt: -1 })
      .exec();
  }

  async getMessages(
    userId: string | Types.ObjectId,
    conversationId: string,
  ): Promise<MessageDocument[]> {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const conv = await this.conversationModel
      .findOne({ _id: conversationId, userId: userObjId })
      .exec();

    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }

    return this.messageModel
      .find({ conversationId: conv._id })
      .sort({ createdAt: 1 })
      .exec();
  }

  async findConversationById(
    userId: string | Types.ObjectId,
    conversationId: string,
  ): Promise<ConversationDocument> {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const conv = await this.conversationModel
      .findOne({ _id: conversationId, userId: userObjId })
      .populate('customerId')
      .exec();

    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }

    return conv;
  }

  async updateBotState(
    conversationId: string | Types.ObjectId,
    botState: string,
    pendingOrderData?: Map<string, string> | Record<string, string>,
  ): Promise<ConversationDocument> {
    const convObjId =
      typeof conversationId === 'string'
        ? new Types.ObjectId(conversationId)
        : conversationId;

    const update: any = { $set: { botState } };
    if (pendingOrderData) {
      update.$set.pendingOrderData = pendingOrderData;
    }

    const updated = await this.conversationModel
      .findByIdAndUpdate(convObjId, update, { new: true })
      .exec();

    if (!updated) {
      throw new NotFoundException('Conversation not found');
    }
    return updated;
  }
}
