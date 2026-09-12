import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
@Module({
  imports: [
    UsersModule,
    PassportModule,
    ConfigModule,
    JwtModule.register({}),
    forwardRef(() => WhatsappModule),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy],
  exports: [AuthService],
})
export class AuthModule {}
