import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Campaign, CampaignDocument, CampaignStatus } from '../schemas/campaign.schema';
import { CustomersService } from '../../customers/customers.service';
import { WhatsappService } from '../../whatsapp/services/whatsapp.service';
import { ConversationsService } from '../../conversations/conversations.service';
import { MessageDirection, MessageStatus } from '../../conversations/schemas/message.schema';
import { CacheService } from '../../common/services/cache.service';
import { Customer, CustomerDocument } from '../../customers/schemas/customer.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';

@Processor('campaign-sending')
export class CampaignProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignProcessor.name);

  constructor(
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly customersService: CustomersService,
    private readonly whatsappService: WhatsappService,
    private readonly conversationsService: ConversationsService,
    private readonly cacheService: CacheService,
  ) {
    super();
  }

  async process(job: Job<{ campaignId: string; userId: string; batchSize?: number; pauseDelayMs?: number }>): Promise<any> {
    const { campaignId, userId } = job.data;
    const batchSize = job.data.batchSize || 50;
    const pauseDelayMs = job.data.pauseDelayMs || 2000;

    this.logger.log(`Starting execution for campaign ${campaignId} (User ${userId}). Batch size: ${batchSize}`);

    const [campaign, user] = await Promise.all([
      this.campaignModel.findById(campaignId).exec(),
      this.userModel.findById(userId).exec(),
    ]);

    if (!campaign) {
      this.logger.error(`Campaign ${campaignId} not found`);
      return;
    }

    // Set campaign status to RUNNING
    campaign.status = CampaignStatus.RUNNING;
    await campaign.save();

    // Fetch target customers for the admin based on campaign settings
    let targetCustomers: CustomerDocument[] = [];
    const filterQuery: any = { createdBy: new Types.ObjectId(userId) };

    if (campaign.targetType === 'specific' && campaign.targetCustomers?.length > 0) {
      filterQuery._id = { $in: campaign.targetCustomers.map(id => new Types.ObjectId(id)) };
      targetCustomers = await this.customerModel.find(filterQuery).exec();
    } else if (campaign.targetType === 'tags' && campaign.targetTags?.length > 0) {
      filterQuery.tags = { $in: campaign.targetTags };
      targetCustomers = await this.customerModel.find(filterQuery).exec();
    } else {
      // Send to all
      targetCustomers = await this.customerModel.find(filterQuery).exec();
    }

    campaign.stats.total = targetCustomers.length;
    await campaign.save();

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < targetCustomers.length; i++) {
      const customer = targetCustomers[i];
      try {
        // Dynamic placeholder replacement
        let personalizedMessage = campaign.message;
        if (user) {
          personalizedMessage = personalizedMessage.replace(/{{business_name}}/gi, user.businessName || '');
        }
        personalizedMessage = personalizedMessage.replace(/{{customer_name}}/gi, customer.name || '');
        personalizedMessage = personalizedMessage.replace(/{{customer_email}}/gi, customer.email || '');
        personalizedMessage = personalizedMessage.replace(/{{customer_mobile}}/gi, customer.mobile || '');
        personalizedMessage = personalizedMessage.replace(/{{date_today}}/gi, new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }));

        // Append call to action link button if provided
        if (campaign.buttonText && campaign.buttonUrl) {
          let resolvedButtonUrl = campaign.buttonUrl;
          if (user) {
            resolvedButtonUrl = resolvedButtonUrl.replace(/{{business_name}}/gi, user.businessName || '');
          }
          resolvedButtonUrl = resolvedButtonUrl.replace(/{{customer_name}}/gi, customer.name || '');
          resolvedButtonUrl = resolvedButtonUrl.replace(/{{customer_email}}/gi, customer.email || '');
          resolvedButtonUrl = resolvedButtonUrl.replace(/{{customer_mobile}}/gi, customer.mobile || '');
          resolvedButtonUrl = resolvedButtonUrl.replace(/{{date_today}}/gi, new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }));

          const btnText = campaign.buttonText.trim();
          const markdownPlaceholder = `[${btnText}]`;
          const rawUrl = resolvedButtonUrl.trim();

          // Replace inline if matched, otherwise append at the end
          if (personalizedMessage.includes(markdownPlaceholder)) {
            personalizedMessage = personalizedMessage.replace(markdownPlaceholder, `*${btnText}* ( ${rawUrl} )`);
          } else if (personalizedMessage.includes(btnText)) {
            // Replace raw text references
            personalizedMessage = personalizedMessage.replace(new RegExp(btnText, 'g'), `*${btnText}* ( ${rawUrl} )`);
          } else {
            personalizedMessage += `\n\n*${btnText}*\n👉 ${rawUrl}`;
          }
        }

        const isSuccess = await this.whatsappService.sendMessage(
          userId,
          customer.mobile,
          personalizedMessage,
          (campaign as any).imageUrl,
        );


        if (isSuccess) {
          sent++;
          // Save conversation log
          const conv = await this.conversationsService.findOrCreateConversation(
            userId,
            customer._id,
          );
          await this.conversationsService.saveMessage(
            conv._id,
            MessageDirection.OUTGOING,
            personalizedMessage,
            MessageStatus.SENT,
          );

          // Update Customer Metrics
          await this.customerModel.updateOne(
            { _id: customer._id },
            {
              $set: { lastCampaign: campaign.name },
              $inc: { totalMessages: 1 },
            },
          );
        } else {
          failed++;
        }
      } catch (err) {
        failed++;
        this.logger.error(
          `Failed sending campaign message to ${customer.mobile}:`,
          err,
        );
      }

      // Update progress stats in DB periodically
      campaign.stats.sent = sent;
      campaign.stats.failed = failed;
      await campaign.save();

      // Batching rate limiter
      if ((i + 1) % batchSize === 0 && (i + 1) < targetCustomers.length) {
        this.logger.log(`Processed ${i + 1} messages. Pausing for ${pauseDelayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, pauseDelayMs));
      } else {
        // Subtle delay between messages in the same batch
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    campaign.status =
      failed === targetCustomers.length && targetCustomers.length > 0
        ? CampaignStatus.FAILED
        : CampaignStatus.COMPLETED;
    await campaign.save();

    // Clear caches
    await this.cacheService.invalidatePrefix(`user:${userId}:dashboard`);
    await this.cacheService.invalidatePrefix(`user:${userId}:campaigns`);
    await this.cacheService.invalidatePrefix(`user:${userId}:customers`);

    this.logger.log(
      `Finished campaign ${campaignId}. Total: ${targetCustomers.length}, Sent: ${sent}, Failed: ${failed}`,
    );

    return { total: targetCustomers.length, sent, failed };
  }
}
