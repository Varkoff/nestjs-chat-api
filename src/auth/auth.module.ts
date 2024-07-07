import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { MailerService } from 'src/mailer.service';
import { PrismaService } from 'src/prisma.service';
import { StripeService } from 'src/stripe/stripe.service';
import { UserService } from 'src/user/user.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      global: true,
      signOptions: { expiresIn: '30d' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    PrismaService,
    JwtStrategy,
    AuthService,
    UserService,
    MailerService,
    AwsS3Service,
    StripeService,
  ],
})
export class AuthModule {}
