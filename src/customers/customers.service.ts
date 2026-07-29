import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Customer, CustomerDocument } from './schemas/customer.schema';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/create-customer.dto';
import { QueryCustomerDto } from './dto/create-customer.dto';
import { CacheService } from '../common/services/cache.service';

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    private readonly cacheService: CacheService,
  ) {}

  async create(userId: string | Types.ObjectId, dto: CreateCustomerDto): Promise<CustomerDocument> {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const existing = await this.customerModel.findOne({
      createdBy: userObjId,
      mobile: dto.mobile,
    });
    if (existing) {
      throw new ConflictException('Customer with this mobile number already exists');
    }

    const customer = new this.customerModel({
      ...dto,
      createdBy: userObjId,
    });
    const saved = await customer.save();
    await this.cacheService.invalidatePrefix(`user:${userObjId.toString()}:customers`);
    return saved;
  }

  async findOrCreateByMobile(
    userId: string | Types.ObjectId,
    mobile: string,
    name: string = 'WhatsApp Customer',
    whatsappJid?: string,
  ): Promise<CustomerDocument> {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    
    let customer: CustomerDocument | null = null;
    if (whatsappJid) {
      customer = await this.customerModel.findOne({ createdBy: userObjId, whatsappJid }).exec();
    }
    if (!customer) {
      customer = await this.customerModel.findOne({ createdBy: userObjId, mobile }).exec();
    }

    if (!customer) {
      customer = await this.customerModel.create({
        name,
        mobile,
        whatsappJid: whatsappJid || '',
        createdBy: userObjId,
        tags: ['WhatsApp'],
      });
      await this.cacheService.invalidatePrefix(`user:${userObjId.toString()}:customers`);
    } else if (whatsappJid && customer.whatsappJid !== whatsappJid) {
      customer.whatsappJid = whatsappJid;
      await customer.save();
      await this.cacheService.invalidatePrefix(`user:${userObjId.toString()}:customers`);
    }
    return customer;
  }

  async findAll(userId: string | Types.ObjectId, query: QueryCustomerDto) {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const cacheKey = `user:${userObjId.toString()}:customers:page:${page}:limit:${limit}:search:${query.search || ''}:tag:${query.tag || ''}:cursor:${query.afterCursor || ''}`;
    const cachedData = await this.cacheService.get<any>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const filter: any = { createdBy: userObjId };

    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { mobile: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } },
      ];
    }

    if (query.tag) {
      filter.tags = query.tag;
    }

    if (query.afterCursor) {
      filter._id = { $lt: new Types.ObjectId(query.afterCursor) };
    }

    const [data, total] = await Promise.all([
      this.customerModel
        .find(filter)
        .sort({ _id: -1 })
        .skip(query.afterCursor ? 0 : skip)
        .limit(limit)
        .exec(),
      this.customerModel.countDocuments({ createdBy: userObjId }).exec(),
    ]);

    const result = {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      nextCursor: data.length > 0 ? data[data.length - 1]._id.toString() : null,
    };

    await this.cacheService.set(cacheKey, result, 300);
    return result;
  }

  async exportAll(userId: string | Types.ObjectId, query: QueryCustomerDto) {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const filter: any = { createdBy: userObjId };

    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { mobile: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } },
      ];
    }

    if (query.tag) {
      filter.tags = query.tag;
    }

    return this.customerModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async findOne(userId: string | Types.ObjectId, id: string): Promise<CustomerDocument> {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const customer = await this.customerModel
      .findOne({ _id: id, createdBy: userObjId })
      .exec();
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }

  async update(
    userId: string | Types.ObjectId,
    id: string,
    dto: UpdateCustomerDto,
  ): Promise<CustomerDocument> {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const customer = await this.customerModel
      .findOneAndUpdate({ _id: id, createdBy: userObjId }, { $set: dto }, { new: true })
      .exec();
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    await this.cacheService.invalidatePrefix(`user:${userObjId.toString()}:customers`);
    return customer;
  }

  async remove(userId: string | Types.ObjectId, id: string): Promise<{ message: string }> {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const result = await this.customerModel
      .deleteOne({ _id: id, createdBy: userObjId })
      .exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('Customer not found');
    }
    await this.cacheService.invalidatePrefix(`user:${userObjId.toString()}:customers`);
    return { message: 'Customer deleted successfully' };
  }
}
