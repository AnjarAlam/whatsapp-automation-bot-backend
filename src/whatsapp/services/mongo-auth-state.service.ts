import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AuthenticationCreds,
  AuthenticationState,
  BufferJSON,
  initAuthCreds,
  SignalDataTypeMap,
} from '@whiskeysockets/baileys';
import {
  WhatsAppSession,
  WhatsAppSessionDocument,
} from '../schemas/whatsapp-session.schema';

@Injectable()
export class MongoAuthStateService {
  private readonly logger = new Logger(MongoAuthStateService.name);

  constructor(
    @InjectModel(WhatsAppSession.name)
    private readonly sessionModel: Model<WhatsAppSessionDocument>,
  ) {}

  async getAuthState(userId: string | Types.ObjectId): Promise<{
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
  }> {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    let session = await this.sessionModel.findOne({ userId: userObjId }).exec();
    if (!session) {
      session = await this.sessionModel.create({
        userId: userObjId,
        authData: {},
      });
    }

    const authData = session.authData || {};

    const creds: AuthenticationCreds = authData.creds
      ? JSON.parse(JSON.stringify(authData.creds), BufferJSON.reviver)
      : initAuthCreds();

    const keysData = authData.keys || {};

    const keys = {
      get: async (type: keyof SignalDataTypeMap, ids: string[]) => {
        const data: { [id: string]: any } = {};
        for (const id of ids) {
          const keyPath = `${type}-${id}`;
          const val = keysData[keyPath];
          if (val) {
            data[id] = JSON.parse(JSON.stringify(val), BufferJSON.reviver);
          }
        }
        return data;
      },
      set: async (data: any) => {
        for (const category in data) {
          for (const id in data[category]) {
            const value = data[category][id];
            const keyPath = `${category}-${id}`;
            if (value) {
              keysData[keyPath] = JSON.parse(
                JSON.stringify(value, BufferJSON.replacer),
              );
            } else {
              delete keysData[keyPath];
            }
          }
        }
        await this.sessionModel.updateOne(
          { userId: userObjId },
          { $set: { 'authData.keys': keysData } },
        );
      },
    };

    const saveCreds = async () => {
      const serializedCreds = JSON.parse(
        JSON.stringify(creds, BufferJSON.replacer),
      );
      await this.sessionModel.updateOne(
        { userId: userObjId },
        { $set: { 'authData.creds': serializedCreds } },
      );
    };

    return {
      state: {
        creds,
        keys,
      },
      saveCreds,
    };
  }
}
