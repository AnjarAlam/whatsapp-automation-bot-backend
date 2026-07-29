import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type FlowDocument = Flow & Document;

@Schema({ _id: false })
export class FlowOption {
  @Prop({ required: true, trim: true })
  key: string;

  @Prop({ required: true, trim: true })
  label: string;

  @Prop({ required: true })
  responseMessage: string;
}

export const FlowOptionSchema = SchemaFactory.createForClass(FlowOption);

@Schema({ timestamps: true })
export class Flow {
  _id: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, lowercase: true, trim: true })
  triggerKeyword: string;

  @Prop({ required: true })
  welcomeMessage: string;

  @Prop({ type: [FlowOptionSchema], default: [] })
  options: FlowOption[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export const FlowSchema = SchemaFactory.createForClass(Flow);
