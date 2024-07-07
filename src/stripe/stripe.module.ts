import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';

@Module({
  controllers: [StripeController],
  providers: [StripeService, PrismaService],
})
export class StripeModule {}
