import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument, OrderStatus } from './schemas/order.schema';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/create-order.dto';
import { CacheService } from '../common/services/cache.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    private readonly cacheService: CacheService,
  ) {}

  async create(userId: string | Types.ObjectId, dto: CreateOrderDto): Promise<OrderDocument> {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    const order = new this.orderModel({
      customer: new Types.ObjectId(dto.customer),
      items: dto.items,
      deliveryType: dto.deliveryType,
      tableNumber: dto.tableNumber || '',
      deliveryAddress: dto.deliveryAddress || '',
      status: OrderStatus.PENDING,
      createdBy: userObjId,
    });

    const saved = await order.save();
    await this.cacheService.invalidatePrefix(`user:${userObjId.toString()}:dashboard`);
    await this.cacheService.invalidatePrefix(`user:${userObjId.toString()}:orders`);
    return saved;
  }

  async findAll(userId: string | Types.ObjectId): Promise<any[]> {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const cacheKey = `user:${userObjId.toString()}:orders`;
    const cached = await this.cacheService.get<any[]>(cacheKey);
    if (cached) return cached;

    const data = await this.orderModel
      .find({ createdBy: userObjId })
      .populate('customer', 'name mobile')
      .sort({ createdAt: -1 })
      .exec();

    await this.cacheService.set(cacheKey, data, 300);
    return data;
  }

  async updateStatus(
    userId: string | Types.ObjectId,
    orderId: string,
    dto: UpdateOrderStatusDto,
  ): Promise<OrderDocument> {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    const order = await this.orderModel
      .findOneAndUpdate(
        { _id: orderId, createdBy: userObjId },
        { $set: { status: dto.status as OrderStatus } },
        { new: true },
      )
      .exec();

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    await this.cacheService.invalidatePrefix(`user:${userObjId.toString()}:dashboard`);
    await this.cacheService.invalidatePrefix(`user:${userObjId.toString()}:orders`);
    return order;
  }

  async remove(userId: string | Types.ObjectId, orderId: string): Promise<{ message: string }> {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    const result = await this.orderModel
      .deleteOne({ _id: orderId, createdBy: userObjId })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('Order not found');
    }

    await this.cacheService.invalidatePrefix(`user:${userObjId.toString()}:dashboard`);
    await this.cacheService.invalidatePrefix(`user:${userObjId.toString()}:orders`);
    return { message: 'Order deleted successfully' };
  }
}
