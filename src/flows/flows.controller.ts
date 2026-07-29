import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FlowsService } from './flows.service';
import { CreateFlowDto, UpdateFlowDto } from './dto/create-flow.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Flows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('flows')
export class FlowsController {
  constructor(private readonly flowsService: FlowsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new automated menu workflow' })
  @ApiResponse({ status: 201, description: 'Flow menu created successfully' })
  async create(@CurrentUser('_id') userId: string, @Body() dto: CreateFlowDto) {
    return this.flowsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all flows created by admin' })
  async findAll(@CurrentUser('_id') userId: string) {
    return this.flowsService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get flow by ID' })
  async findOne(@CurrentUser('_id') userId: string, @Param('id') id: string) {
    return this.flowsService.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update flow menu by ID' })
  async update(
    @CurrentUser('_id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFlowDto,
  ) {
    return this.flowsService.update(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete flow by ID' })
  async remove(@CurrentUser('_id') userId: string, @Param('id') id: string) {
    return this.flowsService.remove(userId, id);
  }
}
