import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type CustomerDocument = Customer & Document;

@Schema({ timestamps: true })
export class Customer {
  _id: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  mobile: string;

  @Prop({ trim: true, default: '' })
  whatsappJid?: string;

  @Prop({ trim: true, default: '' })
  email?: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ default: '' })
  lastCampaign?: string;

  @Prop({ default: 0 })
  totalMessages: number;

  createdAt: Date;
  updatedAt: Date;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
CustomerSchema.index({ createdBy: 1, mobile: 1 }, { unique: true });
CustomerSchema.index({ createdBy: 1, tags: 1 });
CustomerSchema.index({ createdBy: 1, createdAt: -1 });

