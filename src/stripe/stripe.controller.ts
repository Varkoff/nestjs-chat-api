import {
  Controller,
  Param,
  Post,
  RawBodyRequest,
  Request,
  UseGuards,
} from '@nestjs/common';
import { type Request as RequestType } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RequestWithUser } from 'src/auth/jwt.strategy';
import { StripeService } from './stripe.service';

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripe: StripeService) {}

  @UseGuards(JwtAuthGuard)
  @Post('connect')
  //   localhost:3000/stripe/connect POST
  async getConversations(
    @Request() request: RequestWithUser,
  ): Promise<{ accountLink: string }> {
    return await this.stripe.createConnectedAccount({
      userId: request.user.userId,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('donate/:receivingUserId')
  //   localhost:3000/stripe/donate/id POST
  async createDonation(
    @Param('receivingUserId') receivingUserId: string,
    @Request() request: RequestWithUser,
  ): Promise<{ error: boolean; message: string; sessionUrl: string | null }> {
    return await this.stripe.createDonation({
      givingUserId: request.user.userId,
      receivingUserId,
    });
  }

  @Post('webhook')
  //   localhost:3000/stripe/donate/id POST
  async handleWebhooks(@Request() request: RawBodyRequest<RequestType>) {
    return await this.stripe.handleWebhooks({ request });
  }
}
