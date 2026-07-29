import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type OrderDocument = Order & Document;

export enum OrderStatus {
  PENDING = 'Pending',
  PREPARING = 'Preparing',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
}

@Schema({ timestamps: true })
export class Order {
  _id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Customer', required: true })
  customer: Types.ObjectId;

  @Prop({ type: [String], required: true })
  items: string[];

  @Prop({ required: true, enum: ['Dine-in', 'Delivery'], default: 'Dine-in' })
  deliveryType: string;

  @Prop({ default: '' })
  tableNumber?: string;

  @Prop({ default: '' })
  deliveryAddress?: string;

  @Prop({ required: true, enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ createdBy: 1, createdAt: -1 });
