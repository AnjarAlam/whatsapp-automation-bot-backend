import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Flow, FlowDocument } from './schemas/flow.schema';
import { CreateFlowDto, UpdateFlowDto } from './dto/create-flow.dto';

@Injectable()
export class FlowsService {
  constructor(
    @InjectModel(Flow.name)
    private readonly flowModel: Model<FlowDocument>,
  ) {}

  private toObjectId(userId: string | Types.ObjectId): Types.ObjectId {
    if (userId instanceof Types.ObjectId) return userId;
    if (typeof userId === 'string' && Types.ObjectId.isValid(userId)) {
      return new Types.ObjectId(userId);
    }
    return new Types.ObjectId('000000000000000000000000');
  }

  async create(userId: string | Types.ObjectId, dto: CreateFlowDto): Promise<FlowDocument> {
    const userObjId = this.toObjectId(userId);
    const flow = new this.flowModel({
      ...dto,
      triggerKeyword: dto.triggerKeyword.toLowerCase().trim(),
      createdBy: userObjId,
    });
    return flow.save();
  }

  async findAll(userId: string | Types.ObjectId): Promise<FlowDocument[]> {
    const userObjId = this.toObjectId(userId);
    return this.flowModel
      .find({
        $or: [{ createdBy: userObjId }, { createdBy: { $exists: true } }],
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findActiveFlows(userId: string | Types.ObjectId): Promise<FlowDocument[]> {
    const userObjId = this.toObjectId(userId);
    return this.flowModel
      .find({
        $or: [{ createdBy: userObjId }, { createdBy: { $exists: true } }],
        isActive: true,
      })
      .exec();
  }

  async findOne(userId: string | Types.ObjectId, id: string): Promise<FlowDocument> {
    const userObjId = this.toObjectId(userId);
    const flow = await this.flowModel.findOne({ _id: id, createdBy: userObjId }).exec();
    if (!flow) {
      throw new NotFoundException('Flow not found');
    }
    return flow;
  }

  async update(
    userId: string | Types.ObjectId,
    id: string,
    dto: UpdateFlowDto,
  ): Promise<FlowDocument> {
    const userObjId = this.toObjectId(userId);
    const updateData: any = { ...dto };
    if (dto.triggerKeyword) {
      updateData.triggerKeyword = dto.triggerKeyword.toLowerCase().trim();
    }

    const flow = await this.flowModel
      .findOneAndUpdate({ _id: id, createdBy: userObjId }, { $set: updateData }, { new: true })
      .exec();
    if (!flow) {
      throw new NotFoundException('Flow not found');
    }
    return flow;
  }

  async remove(userId: string | Types.ObjectId, id: string): Promise<{ message: string }> {
    const userObjId = this.toObjectId(userId);
    const result = await this.flowModel.deleteOne({ _id: id, createdBy: userObjId }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('Flow not found');
    }
    return { message: 'Flow deleted successfully' };
  }
}
