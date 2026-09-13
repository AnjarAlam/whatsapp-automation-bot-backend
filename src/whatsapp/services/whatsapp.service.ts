import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Client, LocalAuth, Message as WWebMessage } from 'whatsapp-web.js';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import {
  WhatsAppSession,
  WhatsAppSessionDocument,
  WhatsAppStatus,
} from '../schemas/whatsapp-session.schema';
import { IncomingMessageService } from './incoming-message.service';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappService.name);
  private clients: Map<string, Client> = new Map();
  private processedMsgIds: Set<string> = new Set();
  private initializingClients: Set<string> = new Set();

  constructor(
    @InjectModel(WhatsAppSession.name)
    private readonly sessionModel: Model<WhatsAppSessionDocument>,
    @Inject(forwardRef(() => IncomingMessageService))
    private readonly incomingMessageService: IncomingMessageService,
  ) {}

  async onModuleInit() {
    // Reconnect active sessions on startup
    setTimeout(() => {
      this.reconnectAllActiveSessions();
    }, 5000);
  }

  private async reconnectAllActiveSessions() {
    try {
      const activeSessions = await this.sessionModel
        .find({ status: WhatsAppStatus.CONNECTED })
        .exec();

      for (const session of activeSessions) {
        this.logger.log(`Auto-reconnecting WhatsApp-web.js session for user ${session.userId}`);
        this.connect(session.userId.toString()).catch((err) =>
          this.logger.error(`Failed auto-reconnect for ${session.userId}`, err),
        );
      }
    } catch (err) {
      this.logger.error('Error during automatic session reconnection:', err);
    }
  }

  async connect(userId: string): Promise<{ status: string; qrCode?: string }> {
    const userObjId = new Types.ObjectId(userId);

    // If client is already initializing, return status to prevent parallel Puppeteer processes
    if (this.initializingClients.has(userId)) {
      this.logger.warn(`WhatsApp client is already initializing for user ${userId}. Returning status.`);
      const session = await this.sessionModel.findOne({ userId: userObjId });
      return {
        status: session?.status || WhatsAppStatus.CONNECTING,
        qrCode: session?.qrCode || undefined,
      };
    }

    // If client already exists, check health or delete and recreate
    if (this.clients.has(userId)) {
      const existingClient = this.clients.get(userId);
      if (existingClient && (existingClient as any).pupPage) {
        const session = await this.sessionModel.findOne({ userId: userObjId });
        return {
          status: session?.status || WhatsAppStatus.CONNECTED,
          qrCode: session?.qrCode || undefined,
        };
      } else {
        this.logger.warn(`Broken or uninitialized client found in memory for user ${userId}. Clearing client...`);
        this.clients.delete(userId);
      }
    }

    this.initializingClients.add(userId);

    await this.sessionModel.findOneAndUpdate(
      { userId: userObjId },
      { $set: { status: WhatsAppStatus.CONNECTING, qrCode: null } },
      { upsert: true },
    );

    const getChromiumPath = () => {
      if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
        return process.env.PUPPETEER_EXECUTABLE_PATH;
      }
      const knownPaths = [
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
      ];
      for (const p of knownPaths) {
        if (fs.existsSync(p)) return p;
      }
      return undefined;
    };

    const client = new Client({
      authStrategy: new LocalAuth({ clientId: userId }),
      webVersionCache: {
        type: 'local',
      },
      puppeteer: {
        headless: true,
        executablePath: getChromiumPath(),
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      },
    });

    this.clients.set(userId, client);

    const handleMsg = async (msg: WWebMessage) => {
      try {
        if (msg.fromMe || !msg.from || msg.from === 'status@broadcast' || msg.from.includes('@g.us')) {
          return;
        }

        const msgId = msg.id?._serialized || msg.id?.id;
        if (msgId && this.processedMsgIds.has(msgId)) {
          return;
        }
        if (msgId) {
          this.processedMsgIds.add(msgId);
          if (this.processedMsgIds.size > 2000) {
            this.processedMsgIds.clear();
          }
        }

        this.logger.log(`[INCOMING SOCKET MSG] From ${msg.from} for user ${userId}: "${msg.body}"`);
        await this.incomingMessageService.handleIncomingMessage(userId, msg);
      } catch (err) {
        this.logger.error(`Error processing socket message for user ${userId}:`, err);
      }
    };

    client.on('message', handleMsg);
    client.on('message_create', handleMsg);

    client.on('qr', async (qr) => {
      try {
        const qrCodeDataUrl = await QRCode.toDataURL(qr);
        await this.sessionModel.updateOne(
          { userId: userObjId },
          {
            $set: {
              status: WhatsAppStatus.QR_READY,
              qrCode: qrCodeDataUrl,
            },
          },
        );
        this.logger.log(`Generated QR code for user ${userId}`);
      } catch (err) {
        this.logger.error(`Error generating QR DataURL for user ${userId}`, err);
      }
    });

    client.on('ready', async () => {
      const connectedNumber = client.info.wid.user;

      await this.sessionModel.updateOne(
        { userId: userObjId },
        {
          $set: {
            status: WhatsAppStatus.CONNECTED,
            phoneNumber: connectedNumber,
            qrCode: null,
          },
        },
      );
      this.logger.log(
        `WhatsApp connected successfully for user ${userId} (${connectedNumber})`,
      );
    });

    client.on('auth_failure', async (msg) => {
      this.logger.error(`WhatsApp auth failure for user ${userId}: ${msg}`);
      await this.sessionModel.updateOne(
        { userId: userObjId },
        {
          $set: {
            status: WhatsAppStatus.DISCONNECTED,
            phoneNumber: null,
            qrCode: null,
          },
        },
      );
      this.clients.delete(userId);
    });

    client.on('disconnected', async (reason) => {
      this.logger.warn(`WhatsApp disconnected for user ${userId}: ${reason}`);
      await this.sessionModel.updateOne(
        { userId: userObjId },
        {
          $set: {
            status: WhatsAppStatus.DISCONNECTED,
            phoneNumber: null,
            qrCode: null,
          },
        },
      );
      this.clients.delete(userId);
    });



    client.initialize()
      .then(() => {
        this.initializingClients.delete(userId);
        if ((client as any).shouldDestroyImmediately) {
          this.logger.warn(`Client for user ${userId} initialized but marked for destruction. Destroying browser...`);
          client.destroy().catch(() => {});
          this.clients.delete(userId);
        }
      })
      .catch(async (err) => {
        this.initializingClients.delete(userId);
        this.logger.error(`Error initializing client for user ${userId}:`, err);
        if (this.clients.get(userId) === client) {
          this.clients.delete(userId);
        }
        await this.sessionModel.updateOne(
          { userId: userObjId },
          {
            $set: {
              status: WhatsAppStatus.DISCONNECTED,
              phoneNumber: null,
              qrCode: null,
            },
          },
        );
      });

    return {
      status: WhatsAppStatus.CONNECTING,
    };
  }

  async disconnect(userId: string): Promise<{ message: string }> {
    const userObjId = new Types.ObjectId(userId);
    const client = this.clients.get(userId);

    if (this.initializingClients.has(userId) && client) {
      this.logger.warn(`Client for user ${userId} is currently initializing. Flagging for destruction immediately after launch.`);
      (client as any).shouldDestroyImmediately = true;
      this.initializingClients.delete(userId);
    }

    if (client) {
      try {
        await client.destroy();
      } catch (err) {
        this.logger.error(`Error destroying client for user ${userId}:`, err);
      }
      this.clients.delete(userId);
    }

    // Clean up wwebjs auth cache folders to allow a clean QR login immediately
    const sessionPath = path.join(process.cwd(), '.wwebjs_auth', `session-${userId}`);
    if (fs.existsSync(sessionPath)) {
      try {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        this.logger.log(`Deleted wwebjs session directory for user ${userId}: ${sessionPath}`);
      } catch (err) {
        this.logger.error(`Failed to delete wwebjs session directory for user ${userId}: ${sessionPath}`, err);
      }
    }

    await this.sessionModel.updateOne(
      { userId: userObjId },
      {
        $set: {
          status: WhatsAppStatus.DISCONNECTED,
          phoneNumber: null,
          qrCode: null,
        },
      },
    );

    return { message: 'WhatsApp session disconnected successfully and credentials reset' };
  }

  async getStatus(userId: string) {
    const session = await this.sessionModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!session) {
      return {
        status: WhatsAppStatus.DISCONNECTED,
        connectedNumber: null,
        qrCode: null,
      };
    }

    return {
      status: session.status,
      connectedNumber: session.phoneNumber || null,
      qrCode: session.qrCode || null,
    };
  }

  async sendMessage(userId: string, phoneNumber: string, messageText: string, imageUrl?: string): Promise<boolean> {
    const key = userId?.toString();
    let client = this.clients.get(key);
    if (!client && this.clients.size > 0) {
      client = Array.from(this.clients.values())[0];
    }

    if (!client) {
      this.logger.error(`Cannot send message. Active WhatsApp client not found in memory for user ${key}`);
      return false;
    }

    if (!(client as any).pupPage) {
      this.logger.error(`Cannot send message. Puppeteer page not initialized yet for user ${key}. Client status is pending connection.`);
      return false;
    }

    try {
      let cleanNumber = phoneNumber.replace(/[^\d]/g, '');
      // Auto-append Indian country code if user missed it
      if (cleanNumber.length === 10 && !cleanNumber.startsWith('91')) {
        cleanNumber = `91${cleanNumber}`;
      }

      let jid = phoneNumber.includes('@')
        ? phoneNumber
        : `${cleanNumber}@c.us`;

      // Validate if number actually exists on WhatsApp before sending to prevent crash
      // Skip validation for LID, groups, or broadcast lists since getNumberId only works for standard phone numbers
      const isStandardPhone = !phoneNumber.includes('@') || phoneNumber.includes('@c.us') || phoneNumber.includes('@s.whatsapp.net');
      
      if (isStandardPhone) {
        try {
          const numberId = await client.getNumberId(cleanNumber);
          if (!numberId) {
            this.logger.warn(`Number ${cleanNumber} is not registered on WhatsApp. Skipping.`);
            return false;
          }
          jid = numberId._serialized;
        } catch (e) {
          this.logger.warn(`Failed to verify number ${cleanNumber}, attempting send anyway.`);
        }
      }

      if (imageUrl && imageUrl.trim()) {
        try {
          const { MessageMedia } = require('whatsapp-web.js');
          const media = await MessageMedia.fromUrl(imageUrl);
          await client.sendMessage(jid, media, { caption: messageText, linkPreview: true });
          this.logger.log(`Media message sent to ${jid} with caption for user ${key}`);
          return true;
        } catch (mediaErr) {
          this.logger.error(`Failed to fetch media from url: ${imageUrl}, falling back to text.`, mediaErr);
        }
      }

      await client.sendMessage(jid, messageText, { linkPreview: true });
      this.logger.log(`Message successfully sent via WA-Web socket to ${jid} for user ${key}`);
      return true;
    } catch (err) {
      this.logger.error(`Error sending message to ${phoneNumber}:`, err);
      return false;
    }
  }

  async migrateSession(oldId: string, newId: string): Promise<boolean> {
    const oldObjId = new Types.ObjectId(oldId);
    const newObjId = new Types.ObjectId(newId);

    this.logger.log(`Migrating WhatsApp session from ${oldId} to ${newId}`);

    // 1. Destroy old client if it exists in memory
    const oldClient = this.clients.get(oldId);
    if (this.initializingClients.has(oldId) && oldClient) {
      (oldClient as any).shouldDestroyImmediately = true;
      this.initializingClients.delete(oldId);
    }
    if (oldClient) {
      try {
        await oldClient.destroy();
      } catch (err) {
        this.logger.error(`Error destroying old client ${oldId} during migration:`, err);
      }
      this.clients.delete(oldId);
    }

    // 2. Destroy new client if it exists (in case user was already logged in)
    const newClient = this.clients.get(newId);
    if (this.initializingClients.has(newId) && newClient) {
      (newClient as any).shouldDestroyImmediately = true;
      this.initializingClients.delete(newId);
    }
    if (newClient) {
      try {
        await newClient.destroy();
      } catch (err) {
        this.logger.error(`Error destroying new client ${newId} during migration:`, err);
      }
      this.clients.delete(newId);
    }

    // Wait 2 seconds to ensure Chromium completely releases all file locks on Windows
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 3. Rename folder
    const oldPath = path.join(process.cwd(), '.wwebjs_auth', `session-${oldId}`);
    const newPath = path.join(process.cwd(), '.wwebjs_auth', `session-${newId}`);
    
    if (fs.existsSync(newPath)) {
      try {
        fs.rmSync(newPath, { recursive: true, force: true });
      } catch (err) {
        this.logger.error(`Failed to delete existing new path ${newPath}:`, err);
      }
    }

    if (fs.existsSync(oldPath)) {
      try {
        fs.renameSync(oldPath, newPath);
      } catch (err) {
        this.logger.error(`Failed to rename session folder from ${oldPath} to ${newPath}:`, err);
        return false;
      }
    } else {
      this.logger.warn(`Old session folder ${oldPath} not found during migration`);
    }

    // 4. Update DB
    await this.sessionModel.deleteOne({ userId: newObjId });
    await this.sessionModel.updateOne(
      { userId: oldObjId },
      { $set: { userId: newObjId } }
    );

    // 5. Connect new client
    // We don't await because it blocks, but we initiate it
    this.connect(newId).catch(err => {
      this.logger.error(`Failed to connect new migrated session for ${newId}:`, err);
    });
    
    return true;
  }
}
