import { Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WhatsappService } from './services/whatsapp.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('connect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate Baileys session & generate QR code for WhatsApp connection' })
  @ApiResponse({ status: 200, description: 'Returns connection status and QR code base64 DataURL' })
  async connect(@CurrentUser('_id') userId: string) {
    return this.whatsappService.connect(userId.toString());
  }

  @Post('disconnect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disconnect WhatsApp session and clear session credentials' })
  @ApiResponse({ status: 200, description: 'Disconnected successfully' })
  async disconnect(@CurrentUser('_id') userId: string) {
    return this.whatsappService.disconnect(userId.toString());
  }

  @Get('status')
  @ApiOperation({ summary: 'Get current WhatsApp connection status, QR code, and connected number' })
  @ApiResponse({ status: 200, description: 'Current WhatsApp session status' })
  async getStatus(@CurrentUser('_id') userId: string) {
    return this.whatsappService.getStatus(userId.toString());
  }
}
