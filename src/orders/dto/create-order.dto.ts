import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ example: '60d5ec4b9b1d8b3a7c88b901', description: 'Customer ID' })
  @IsString()
  @IsNotEmpty()
  customer: string;

  @ApiProperty({ example: ['Margherita Pizza'], description: 'Ordered items' })
  @IsArray()
  @IsString({ each: true })
  items: string[];

  @ApiProperty({ example: 'Dine-in', enum: ['Dine-in', 'Delivery'] })
  @IsEnum(['Dine-in', 'Delivery'])
  deliveryType: string;

  @ApiPropertyOptional({ example: 'Table 5' })
  @IsOptional()
  @IsString()
  tableNumber?: string;

  @ApiPropertyOptional({ example: 'House 45, Sector 4' })
  @IsOptional()
  @IsString()
  deliveryAddress?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ example: 'Preparing', enum: ['Pending', 'Preparing', 'Completed', 'Cancelled'] })
  @IsEnum(['Pending', 'Preparing', 'Completed', 'Cancelled'])
  status: string;
}
