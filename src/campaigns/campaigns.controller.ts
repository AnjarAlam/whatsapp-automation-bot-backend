import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new campaign draft or scheduled campaign' })
  @ApiResponse({ status: 201, description: 'Campaign created successfully' })
  async create(@CurrentUser('_id') userId: string, @Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(userId, dto);
  }

  @Post(':id/launch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Launch campaign execution via BullMQ queue worker' })
  @ApiResponse({ status: 200, description: 'Campaign job queued' })
  async launch(@CurrentUser('_id') userId: string, @Param('id') id: string) {
    return this.campaignsService.launch(userId, id);
  }

  @Get()
  @ApiOperation({ summary: 'Get list of all campaigns created by admin' })
  async findAll(@CurrentUser('_id') userId: string) {
    return this.campaignsService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get campaign details & delivery statistics' })
  async findOne(@CurrentUser('_id') userId: string, @Param('id') id: string) {
    return this.campaignsService.findOne(userId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete campaign by ID' })
  async remove(@CurrentUser('_id') userId: string, @Param('id') id: string) {
    return this.campaignsService.remove(userId, id);
  }
}
