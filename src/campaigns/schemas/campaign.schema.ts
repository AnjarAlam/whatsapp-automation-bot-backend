import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type CampaignDocument = Campaign & Document;

export enum CampaignType {
  OFFER = 'Offer',
  FESTIVAL = 'Festival',
  ANNOUNCEMENT = 'Announcement',
  REMINDER = 'Reminder',
}

export enum CampaignStatus {
  DRAFT = 'Draft',
  SCHEDULED = 'Scheduled',
  RUNNING = 'Running',
  COMPLETED = 'Completed',
  FAILED = 'Failed',
}

@Schema({ _id: false })
export class CampaignStats {
  @Prop({ default: 0 })
  total: number;

  @Prop({ default: 0 })
  sent: number;

  @Prop({ default: 0 })
  failed: number;
}

export const CampaignStatsSchema = SchemaFactory.createForClass(CampaignStats);

@Schema({ timestamps: true })
export class Campaign {
  _id: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ enum: CampaignType, required: true })
  type: CampaignType;

  @Prop({ required: true })
  message: string;

  @Prop({ enum: CampaignStatus, default: CampaignStatus.DRAFT })
  status: CampaignStatus;

  @Prop({ type: CampaignStatsSchema, default: () => ({ total: 0, sent: 0, failed: 0 }) })
  stats: CampaignStats;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ default: 'all' })
  targetType: string;

  @Prop({ type: [String], default: [] })
  targetCustomers: string[];

  @Prop({ type: [String], default: [] })
  targetTags: string[];

  @Prop({ default: null })
  scheduledAt?: Date;

  @Prop({ default: '' })
  imageUrl?: string;

  @Prop({ default: '' })
  buttonText?: string;

  @Prop({ default: '' })
  buttonUrl?: string;

  createdAt: Date;
  updatedAt: Date;
}


export const CampaignSchema = SchemaFactory.createForClass(Campaign);
