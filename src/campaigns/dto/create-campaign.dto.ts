import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CampaignType } from '../schemas/campaign.schema';

export class CreateCampaignDto {
  @ApiProperty({ example: 'Summer Festival Sale', description: 'Campaign title/name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: CampaignType, example: CampaignType.OFFER, description: 'Type of campaign' })
  @IsEnum(CampaignType)
  @IsNotEmpty()
  type: CampaignType;

  @ApiProperty({
    example: 'Special 20% discount on all items! Use code SUMMER20.',
    description: 'Broadcast message content',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    example: '2026-08-01T10:00:00.000Z',
    description: 'Scheduled execution timestamp',
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ example: 'all', description: 'Target audience selection type: all, specific, or tags' })
  @IsOptional()
  @IsString()
  targetType?: string;

  @ApiPropertyOptional({ example: ['60d5ec4b9b1d8b3a7c88b901'], description: 'Target customer ID list' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetCustomers?: string[];

  @ApiPropertyOptional({ example: ['VIP', 'Regular'], description: 'Target tag list' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetTags?: string[];

  @ApiPropertyOptional({ example: 'https://images.unsplash.com/...', description: 'Optional campaign header image URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'Buy Now', description: 'Call to action button text' })
  @IsOptional()
  @IsString()
  buttonText?: string;

  @ApiPropertyOptional({ example: 'https://example.com/checkout', description: 'Call to action button redirect URL' })
  @IsOptional()
  @IsString()
  buttonUrl?: string;
}

