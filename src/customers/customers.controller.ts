import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/create-customer.dto';
import { QueryCustomerDto } from './dto/create-customer.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new customer' })
  @ApiResponse({ status: 201, description: 'Customer created successfully' })
  async create(@CurrentUser('_id') userId: string, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get paginated list of customers with search & filter' })
  async findAll(@CurrentUser('_id') userId: string, @Query() query: QueryCustomerDto) {
    return this.customersService.findAll(userId, query);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export all customers matching search & filter' })
  async exportAll(@CurrentUser('_id') userId: string, @Query() query: QueryCustomerDto) {
    return this.customersService.exportAll(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single customer details by ID' })
  async findOne(@CurrentUser('_id') userId: string, @Param('id') id: string) {
    return this.customersService.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update customer details by ID' })
  async update(
    @CurrentUser('_id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete customer by ID' })
  async remove(@CurrentUser('_id') userId: string, @Param('id') id: string) {
    return this.customersService.remove(userId, id);
  }
}
