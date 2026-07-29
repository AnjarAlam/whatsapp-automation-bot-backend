import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type MessageDocument = Message & Document;

export enum MessageDirection {
  INCOMING = 'incoming',
  OUTGOING = 'outgoing',
}

export enum MessageStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  RECEIVED = 'received',
}

@Schema({ timestamps: true })
export class Message {
  _id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;

  @Prop({ enum: MessageDirection, required: true })
  direction: MessageDirection;

  @Prop({ required: true })
  message: string;

  @Prop({ enum: MessageStatus, default: MessageStatus.PENDING })
  status: MessageStatus;

  @Prop({ default: null })
  waMessageId?: string;

  @Prop({ default: '' })
  imageUrl?: string;

  @Prop({ default: Date.now })
  timestamp: Date;
}


export const MessageSchema = SchemaFactory.createForClass(Message);
