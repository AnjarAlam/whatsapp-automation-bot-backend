import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import { WhatsappService } from '../whatsapp/services/whatsapp.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => WhatsappService))
    private readonly whatsappService: WhatsappService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingEmail = await this.usersService.findByEmail(registerDto.email);
    if (existingEmail) {
      throw new ConflictException('User with this email already exists');
    }

    const existingMobile = await this.usersService.findByMobile(registerDto.mobile);
    if (existingMobile) {
      throw new ConflictException('User with this mobile number already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
    });

    const tokens = await this.generateTokens(user._id.toString(), user.email);
    const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
    await this.usersService.updateRefreshToken(user._id, hashedRefreshToken);

    if (registerDto.tempSessionId) {
      await this.whatsappService.migrateSession(registerDto.tempSessionId, user._id.toString());
    }

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const { emailOrMobile, password } = loginDto;

    let user: UserDocument | null = await this.usersService.findByEmail(emailOrMobile);
    if (!user) {
      user = await this.usersService.findByMobile(emailOrMobile);
    }

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user._id.toString(), user.email);
    const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
    await this.usersService.updateRefreshToken(user._id, hashedRefreshToken);

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.usersService.findById(userId);
    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Access denied');
    }

    const refreshTokenMatches = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!refreshTokenMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.generateTokens(user._id.toString(), user.email);
    const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
    await this.usersService.updateRefreshToken(user._id, hashedRefreshToken);

    return tokens;
  }

  async logout(userId: string) {
    await this.usersService.updateRefreshToken(userId, null);
    return { message: 'Logged out successfully' };
  }

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };
    const secret = this.configService.get<string>('jwt.secret') || 'secret';
    const refreshSecret = this.configService.get<string>('jwt.refreshSecret') || 'refreshSecret';
    const expiresIn = (this.configService.get<string>('jwt.expiresIn') || '1d') as any;
    const refreshExpiresIn = (this.configService.get<string>('jwt.refreshExpiresIn') || '7d') as any;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret,
        expiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  sanitizeUser(user: UserDocument) {
    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.refreshToken;
    return userObj;
  }

  async toggleBotActive(userId: string): Promise<any> {
    const user = await this.usersService.toggleBotActive(userId);
    return this.sanitizeUser(user);
  }

  async initWhatsappLogin() {
    const tempSessionId = new Types.ObjectId().toString();
    const status = await this.whatsappService.connect(tempSessionId);
    return { tempSessionId, ...status };
  }

  async checkWhatsappLoginStatus(sessionId: string) {
    const status = await this.whatsappService.getStatus(sessionId);
    if (status.status === 'CONNECTED' && status.connectedNumber) {
      let user = await this.usersService.findByMobile(status.connectedNumber);
      if (user) {
        await this.whatsappService.migrateSession(sessionId, user._id.toString());
        const tokens = await this.generateTokens(user._id.toString(), user.email);
        const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
        await this.usersService.updateRefreshToken(user._id, hashedRefreshToken);
        
        return {
          status: 'success',
          user: this.sanitizeUser(user),
          tokens
        };
      } else {
        return {
          status: 'requires_registration',
          tempSessionId: sessionId,
          phoneNumber: status.connectedNumber
        };
      }
    }
    
    return status;
  }

  async cancelWhatsappLogin(sessionId: string) {
    return this.whatsappService.disconnect(sessionId);
  }
}
