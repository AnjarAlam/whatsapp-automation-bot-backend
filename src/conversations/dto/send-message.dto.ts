import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ example: 'Hello! How can I assist you today?', description: 'Message content' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ example: 'https://...', description: 'Optional image attachment URL', required: false })
  @IsString()
  @IsOptional()
  imageUrl?: string;
}

