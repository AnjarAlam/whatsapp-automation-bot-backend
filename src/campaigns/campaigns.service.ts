import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Campaign, CampaignDocument, CampaignStatus } from './schemas/campaign.schema';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CacheService } from '../common/services/cache.service';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    @InjectQueue('campaign-sending')
    private readonly campaignQueue: Queue,
    private readonly cacheService: CacheService,
  ) {}

  async create(userId: string | Types.ObjectId, dto: CreateCampaignDto): Promise<CampaignDocument> {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    const initialStatus = dto.scheduledAt ? CampaignStatus.SCHEDULED : CampaignStatus.DRAFT;

    const campaign = new this.campaignModel({
      ...dto,
      status: initialStatus,
      createdBy: userObjId,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      targetType: dto.targetType || 'all',
      targetCustomers: dto.targetCustomers || [],
      targetTags: dto.targetTags || [],
    });

    const savedCampaign = await campaign.save();

    await this.cacheService.invalidatePrefix(`user:${userObjId.toString()}:dashboard`);
    await this.cacheService.invalidatePrefix(`user:${userObjId.toString()}:campaigns`);

    // If scheduledAt is specified, schedule job in BullMQ
    if (dto.scheduledAt) {
      const delay = new Date(dto.scheduledAt).getTime() - Date.now();
      if (delay > 0) {
        await this.campaignQueue.add(
          'execute-campaign',
          { campaignId: savedCampaign._id.toString(), userId: userObjId.toString() },
          { delay },
        );
      }
    }

    return savedCampaign;
  }

  async launch(userId: string | Types.ObjectId, id: string): Promise<CampaignDocument> {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const campaign = await this.campaignModel.findOne({ _id: id, createdBy: userObjId }).exec();

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    campaign.status = CampaignStatus.SCHEDULED;
    await campaign.save();

    await this.cacheService.invalidatePrefix(`user:${userObjId.toString()}:dashboard`);
    await this.cacheService.invalidatePrefix(`user:${userObjId.toString()}:campaigns`);

    // Add job to BullMQ queue immediately
    await this.campaignQueue.add('execute-campaign', {
      campaignId: campaign._id.toString(),
      userId: userObjId.toString(),
    });

    return campaign;
  }

  async findAll(userId: string | Types.ObjectId): Promise<CampaignDocument[]> {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const cacheKey = `user:${userObjId.toString()}:campaigns`;
    const cached = await this.cacheService.get<CampaignDocument[]>(cacheKey);
    if (cached) return cached;

    const data = await this.campaignModel.find({ createdBy: userObjId }).sort({ createdAt: -1 }).exec();
    await this.cacheService.set(cacheKey, data, 300);
    return data;
  }

  async findOne(userId: string | Types.ObjectId, id: string): Promise<CampaignDocument> {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const campaign = await this.campaignModel.findOne({ _id: id, createdBy: userObjId }).exec();
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    return campaign;
  }

  async remove(userId: string | Types.ObjectId, id: string): Promise<{ message: string }> {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const result = await this.campaignModel.deleteOne({ _id: id, createdBy: userObjId }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('Campaign not found');
    }
    await this.cacheService.invalidatePrefix(`user:${userObjId.toString()}:dashboard`);
    await this.cacheService.invalidatePrefix(`user:${userObjId.toString()}:campaigns`);
    return { message: 'Campaign deleted successfully' };
  }
}
