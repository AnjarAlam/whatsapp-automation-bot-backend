import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'John Doe', description: 'Full name of business owner' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'ABC Grocery Store', description: 'Business name' })
  @IsString()
  @IsNotEmpty()
  businessName: string;

  @ApiProperty({ example: 'john@example.com', description: 'Email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '+1234567890', description: 'Mobile phone number' })
  @IsString()
  @IsNotEmpty()
  mobile: string;

  @ApiProperty({ example: 'password123', description: 'Password (min 6 characters)' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'Temporary WhatsApp session ID to link during registration', required: false })
  @IsString()
  @IsOptional()
  tempSessionId?: string;
}
