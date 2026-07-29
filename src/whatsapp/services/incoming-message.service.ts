import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Message as WWebMessage } from 'whatsapp-web.js';
import { CustomersService } from '../../customers/customers.service';
import { FlowsService } from '../../flows/flows.service';
import { ConversationsService } from '../../conversations/conversations.service';
import { MessageDirection, MessageStatus } from '../../conversations/schemas/message.schema';
import { WhatsappService } from './whatsapp.service';
import { UsersService } from '../../users/users.service';
import { OrdersService } from '../../orders/orders.service';

@Injectable()
export class IncomingMessageService {
  private readonly logger = new Logger(IncomingMessageService.name);

  constructor(
    private readonly customersService: CustomersService,
    private readonly flowsService: FlowsService,
    private readonly conversationsService: ConversationsService,
    private readonly usersService: UsersService,
    private readonly ordersService: OrdersService,
    @Inject(forwardRef(() => WhatsappService))
    private readonly whatsappService: WhatsappService,
  ) {}

  async handleIncomingMessage(userId: string, msg: WWebMessage) {
    try {
      // Ignore outgoing or status broadcast or group messages
      if (msg.fromMe || !msg.from || msg.from === 'status@broadcast' || msg.from.includes('@g.us')) {
        return;
      }

      const remoteJid = msg.from;
      // Extract pure mobile digits without device suffixes (:1, :2) or domain extensions (@c.us, @s.whatsapp.net)
      const rawNumber = remoteJid.split('@')[0].split(':')[0];
      const mobile = rawNumber.replace(/[^\d]/g, '');

      if (!mobile || mobile.length < 5) {
        this.logger.warn(`Ignored message with invalid mobile extraction from JID: ${remoteJid}`);
        return;
      }

      const messageText = msg.body || '';
      if (!messageText.trim()) {
        return;
      }

      // Fetch contact details asynchronously with a 1-second timeout so it never blocks execution
      let senderName = `User ${mobile.slice(-4)}`;
      try {
        const contactPromise = msg.getContact();
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 1000));
        const contact: any = await Promise.race([contactPromise, timeoutPromise]);
        if (contact) {
          senderName = contact.pushname || contact.name || senderName;
        }
      } catch (err) {
        this.logger.debug(`Could not resolve contact info for ${mobile}`);
      }

      this.logger.log(
        `[INCOMING MESSAGE] From ${senderName} (${mobile}) for User ${userId}: "${messageText}"`,
      );

      // 1. Identify/Auto-create Customer
      const customer = await this.customersService.findOrCreateByMobile(
        userId,
        mobile,
        senderName,
        remoteJid,
      );

      // 2. Find/Create Conversation
      const conversation = await this.conversationsService.findOrCreateConversation(
        userId,
        customer._id,
      );

      // 3. Save incoming message record
      await this.conversationsService.saveMessage(
        conversation._id,
        MessageDirection.INCOMING,
        messageText,
        MessageStatus.RECEIVED,
        msg.id?.id || undefined,
      );

      // 4. Automated Flow Menu Processing
      const user = await this.usersService.findById(userId).catch(() => null);
      if (user && user.isBotActive) {
        await this.processAutomatedReply(userId, remoteJid, messageText.trim(), conversation._id.toString());
      } else {
        this.logger.log(`[AUTO-RESPONDER SKIPPED] Auto-replies are paused. Bot is currently deactivated for user ${userId}`);
      }
    } catch (error) {
      this.logger.error(`Error processing incoming message for user ${userId}:`, error);
    }
  }

  private async processAutomatedReply(
    userId: string,
    remoteJid: string,
    incomingText: string,
    conversationId: string,
  ) {
    const mobile = remoteJid.split('@')[0].split(':')[0].replace(/[^\d]/g, '');
    this.logger.log(`[AUTO-RESPONDER] Evaluating state-based reply for ${mobile} (${remoteJid}): "${incomingText}"`);

    const cleanedText = incomingText.trim().toLowerCase();

    // Load dynamic trigger keywords from DB configurations
    let triggerKeywords: string[] = [];
    try {
      const dbFlows = await this.flowsService.findAll(userId);
      if (dbFlows && dbFlows.length > 0) {
        dbFlows.forEach((flow) => {
          if (flow.isActive !== false) {
            const kws = (flow.triggerKeyword || '')
              .split(',')
              .map((k: string) => k.trim().toLowerCase())
              .filter((k: string) => k.length > 0);
            triggerKeywords.push(...kws);
          }
        });
      }
    } catch (err) {
      this.logger.error('Failed to load flows for keyword trigger validation:', err);
    }

    // Default fallbacks if no flows exist in DB yet
    if (triggerKeywords.length === 0) {
      triggerKeywords = ['hi', 'hello', 'hey', 'start', 'menu', 'reset'];
    }

    const rawWord = cleanedText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '').trim();
    const isResetKeyword = triggerKeywords.includes(rawWord);

    const isBackKeyword = ['back', '0', '00'].includes(cleanedText);

    const conv = await this.conversationsService.findConversationById(userId, conversationId).catch(() => null);
    let currentBotState = isResetKeyword ? 'idle' : (conv?.botState || 'idle');
    
    // Safety convert mongoose map to object
    const pendingData: Record<string, string> = {};
    if (conv?.pendingOrderData) {
      if (typeof (conv.pendingOrderData as any).get === 'function') {
        conv.pendingOrderData.forEach((val, key) => {
          pendingData[key] = val;
        });
      } else {
        Object.assign(pendingData, conv.pendingOrderData);
      }
    }

    // Apply back navigation transitions
    if (isBackKeyword && !isResetKeyword) {
      if (currentBotState === 'waiting_for_menu_choice' || currentBotState === 'waiting_for_pizza_choice') {
        currentBotState = 'idle';
      } else if (currentBotState === 'waiting_for_delivery_choice') {
        currentBotState = 'go_back_to_pizza';
      } else if (currentBotState === 'waiting_for_table' || currentBotState === 'waiting_for_address') {
        currentBotState = 'go_back_to_delivery';
      }
    }

    let replyMessage = '';
    let nextBotState = 'idle';
    let nextPendingData: Record<string, string> = { ...pendingData };

    if (currentBotState === 'idle' || isResetKeyword) {
      replyMessage = `Welcome to ABC Pizza Restaurant! 🍕\n\n1️⃣ Press *1* to View Menu & Order\n2️⃣ Press *2* to Track Existing Order\n3️⃣ Press *3* for Customer Support\n\nReply with *1*, *2*, or *3* to proceed:`;
      nextBotState = 'waiting_for_menu_choice';
      nextPendingData = {};
    } 
    else if (currentBotState === 'waiting_for_menu_choice') {
      if (cleanedText === '1') {
        replyMessage = `Today's Pizza Menu:\n1️⃣ Margherita Pizza - $10\n2️⃣ Pepperoni Pizza - $12\n3️⃣ Veggie Deluxe Pizza - $11\n\nPlease select a pizza by replying with *1*, *2*, or *3*:\n\n↩️ Reply *0* to go back.`;
        nextBotState = 'waiting_for_pizza_choice';
      } else if (cleanedText === '2') {
        replyMessage = `You have no active orders. Reply *hi* to return to the main menu.`;
        nextBotState = 'idle';
        nextPendingData = {};
      } else if (cleanedText === '3') {
        replyMessage = `Connecting you to a human agent. An agent will message you shortly.`;
        nextBotState = 'idle';
        nextPendingData = {};
      } else {
        replyMessage = `Invalid option. Please reply with:\n1️⃣ for Pizza Menu\n2️⃣ to Track Orders\n3️⃣ for Support:`;
        nextBotState = 'waiting_for_menu_choice';
      }
    } 
    else if (currentBotState === 'waiting_for_pizza_choice') {
      let pizza = '';
      if (cleanedText === '1') pizza = 'Margherita Pizza';
      else if (cleanedText === '2') pizza = 'Pepperoni Pizza';
      else if (cleanedText === '3') pizza = 'Veggie Deluxe Pizza';

      if (pizza) {
        nextPendingData.item = pizza;
        replyMessage = `Great choice: *${pizza}*! 🍕 Is this order for:\n1️⃣ Table Service (Dine-in)\n2️⃣ Home Delivery\n\nPlease reply with *1* or *2*:\n\n↩️ Reply *0* to go back.`;
        nextBotState = 'waiting_for_delivery_choice';
      } else {
        replyMessage = `Invalid selection. Please select a pizza by replying with *1*, *2*, or *3*:\n1️⃣ Margherita\n2️⃣ Pepperoni\n3️⃣ Veggie Deluxe\n\n↩️ Reply *0* to go back.`;
        nextBotState = 'waiting_for_pizza_choice';
      }
    } 
    else if (currentBotState === 'go_back_to_pizza') {
      replyMessage = `Today's Pizza Menu:\n1️⃣ Margherita Pizza - $10\n2️⃣ Pepperoni Pizza - $12\n3️⃣ Veggie Deluxe Pizza - $11\n\nPlease select a pizza by replying with *1*, *2*, or *3*:\n\n↩️ Reply *0* to go back.`;
      nextBotState = 'waiting_for_pizza_choice';
    }
    else if (currentBotState === 'waiting_for_delivery_choice') {
      if (cleanedText === '1') {
        nextPendingData.deliveryType = 'Dine-in';
        replyMessage = `Please reply with your Table Number (e.g., "5" or "Table 12"):\n\n↩️ Reply *0* to go back.`;
        nextBotState = 'waiting_for_table';
      } else if (cleanedText === '2') {
        nextPendingData.deliveryType = 'Delivery';
        replyMessage = `Please reply with your Delivery Address (House number, Street, Area):\n\n↩️ Reply *0* to go back.`;
        nextBotState = 'waiting_for_address';
      } else {
        replyMessage = `Invalid option. Please select your delivery type:\n1️⃣ Table Service (Dine-in)\n2️⃣ Home Delivery\n\nReply with *1* or *2*:\n\n↩️ Reply *0* to go back.`;
        nextBotState = 'waiting_for_delivery_choice';
      }
    } 
    else if (currentBotState === 'go_back_to_delivery') {
      const pizza = pendingData.item || 'Pizza';
      replyMessage = `Is this order for:\n1️⃣ Table Service (Dine-in)\n2️⃣ Home Delivery\n\nPlease reply with *1* or *2*:\n\n↩️ Reply *0* to go back.`;
      nextBotState = 'waiting_for_delivery_choice';
    }
    else if (currentBotState === 'waiting_for_table') {
      const tableNumber = incomingText.trim();
      const item = pendingData.item || 'Pizza';
      
      try {
        const customerName = conv?.customerId ? (conv.customerId as any).name || `WhatsApp Contact ${mobile}` : `WhatsApp Contact ${mobile}`;
        const customer = await this.customersService.findOrCreateByMobile(userId, mobile, customerName, remoteJid);

        await this.ordersService.create(userId, {
          customer: customer._id.toString(),
          items: [item],
          deliveryType: 'Dine-in',
          tableNumber: tableNumber,
        });

        replyMessage = `Order placed successfully for Table *${tableNumber}*! 🎉🍕 Your *${item}* is being prepared by our chefs and will be served shortly. Thank you!`;
      } catch (err) {
        this.logger.error('Failed to create dine-in order via bot:', err);
        replyMessage = `Sorry, we encountered an error placing your order. Please try again or type *AGENT*.`;
      }
      
      nextBotState = 'idle';
      nextPendingData = {};
    } 
    else if (currentBotState === 'waiting_for_address') {
      const address = incomingText.trim();
      const item = pendingData.item || 'Pizza';
      
      try {
        const customerName = conv?.customerId ? (conv.customerId as any).name || `WhatsApp Contact ${mobile}` : `WhatsApp Contact ${mobile}`;
        const customer = await this.customersService.findOrCreateByMobile(userId, mobile, customerName, remoteJid);

        await this.ordersService.create(userId, {
          customer: customer._id.toString(),
          items: [item],
          deliveryType: 'Delivery',
          deliveryAddress: address,
        });

        replyMessage = `Order placed successfully for Home Delivery! 🚚🍕 Your *${item}* is being prepared and will be delivered to:\n📍 *${address}*\n\nExpected arrival: 30 minutes. Thank you!`;
      } catch (err) {
        this.logger.error('Failed to create delivery order via bot:', err);
        replyMessage = `Sorry, we encountered an error placing your order. Please try again or type *AGENT*.`;
      }

      nextBotState = 'idle';
      nextPendingData = {};
    }

    // Save state back to conversation
    if (conv) {
      await this.conversationsService.updateBotState(conversationId, nextBotState, nextPendingData);
    }

    this.logger.log(
      `[AUTO-RESPONDER DISPATCH] Sending automated WhatsApp reply to ${mobile} (${remoteJid}) (State: ${nextBotState}): "${replyMessage}"`,
    );

    // Send automated WhatsApp message
    const sent = await this.whatsappService.sendMessage(userId, remoteJid, replyMessage);

    if (sent) {
      // Record outgoing automated reply in conversation log
      await this.conversationsService.saveMessage(
        conversationId,
        MessageDirection.OUTGOING,
        replyMessage,
        MessageStatus.SENT,
      );
      this.logger.log(`[AUTO-RESPONDER SUCCESS] Reply successfully dispatched & logged for ${mobile} (${remoteJid})`);
    } else {
      this.logger.error(`[AUTO-RESPONDER FAILURE] Could not dispatch reply via whatsappService to ${mobile} (${remoteJid})`);
    }
  }
}
