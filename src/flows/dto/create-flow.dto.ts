import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class FlowOptionDto {
  @ApiProperty({ example: '1', description: 'Option reply trigger key' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ example: 'View Menu', description: 'Menu option label' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({
    example: "Today's Menu:\n1. Burger\n2. Pizza\n3. Sandwich",
    description: 'Auto response message for this option key',
  })
  @IsString()
  @IsNotEmpty()
  responseMessage: string;
}

export class CreateFlowDto {
  @ApiProperty({ example: 'Main Store Customer Menu', description: 'Flow menu title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'hi', description: 'Keyword to trigger flow welcome menu' })
  @IsString()
  @IsNotEmpty()
  triggerKeyword: string;

  @ApiProperty({
    example:
      'Welcome to ABC Grocery!\nReply:\n1 → View Menu\n2 → Place Order\n3 → Support\n4 → Location',
    description: 'Welcome menu text sent to customer when flow is triggered',
  })
  @IsString()
  @IsNotEmpty()
  welcomeMessage: string;

  @ApiProperty({ type: [FlowOptionDto], description: 'Options menu list' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FlowOptionDto)
  options: FlowOptionDto[];

  @ApiPropertyOptional({ example: true, description: 'Is flow active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFlowDto extends PartialType(CreateFlowDto) {}
