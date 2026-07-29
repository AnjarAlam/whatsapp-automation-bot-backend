import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type WhatsAppSessionDocument = WhatsAppSession & Document;

export enum WhatsAppStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  QR_READY = 'QR_READY',
}

@Schema({ timestamps: true })
export class WhatsAppSession {
  _id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ enum: WhatsAppStatus, default: WhatsAppStatus.DISCONNECTED })
  status: WhatsAppStatus;

  @Prop({ default: null })
  phoneNumber?: string;

  @Prop({ default: null })
  qrCode?: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  authData?: Record<string, any>;

  updatedAt: Date;
}

export const WhatsAppSessionSchema = SchemaFactory.createForClass(WhatsAppSession);
