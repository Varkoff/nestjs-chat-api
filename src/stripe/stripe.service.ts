import { Injectable, RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from 'src/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;

  constructor(private readonly prisma: PrismaService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
  }

  async createConnectedAccount({
    userId,
  }: {
    userId: string;
  }): Promise<{ accountLink: string }> {
    const existingUser = await this.prisma.user.findUniqueOrThrow({
      where: {
        id: userId,
      },
      select: {
        id: true,
        stripeAccountId: true,
        email: true,
      },
    });

    if (existingUser.stripeAccountId) {
      const accountLink = await this.createAccountLink({
        stripeAccountId: existingUser.stripeAccountId,
      });
      return { accountLink: accountLink.url };
    }

    const stripeAccount = await this.stripe.accounts.create({
      type: 'express',
      email: existingUser.email,
      default_currency: 'EUR',
    });

    await this.prisma.user.update({
      where: {
        id: existingUser.id,
      },
      data: {
        stripeAccountId: stripeAccount.id,
      },
    });

    const accountLink = await this.createAccountLink({
      stripeAccountId: stripeAccount.id,
    });

    return { accountLink: accountLink.url };
  }

  async createAccountLink({ stripeAccountId }: { stripeAccountId: string }) {
    return await this.stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: 'http://localhost:3000/onboarding',
      return_url: 'http://localhost:3000',
      type: 'account_onboarding',
    });
  }

  async getStripeAccount({ stripeAccountId }: { stripeAccountId: string }) {
    const stripeAccount = await this.stripe.accounts.retrieve(stripeAccountId);
    const canReceiveMoney = stripeAccount.charges_enabled;

    return { stripeAccount, canReceiveMoney };
  }

  async createDonation({
    receivingUserId,
    givingUserId,
  }: {
    receivingUserId: string;
    givingUserId: string;
  }): Promise<{ error: boolean; message: string; sessionUrl: string | null }> {
    try {
      if (receivingUserId === givingUserId) {
        throw new Error('Vous ne pouvez pas vous faire de dons à vous-même');
      }
      const [receivingUser, givingUser] = await Promise.all([
        this.prisma.user.findUniqueOrThrow({
          where: {
            id: receivingUserId,
          },
          select: {
            id: true,
            firstName: true,
            stripeProductId: true,
            stripeAccountId: true,
          },
        }),
        this.prisma.user.findUniqueOrThrow({
          where: {
            id: givingUserId,
          },
          select: {
            id: true,
            stripeAccountId: true,
          },
        }),
      ]);

      if (!receivingUser.stripeAccountId) {
        throw new Error(
          "L'utilisateur recevant le don n'a pas de compte Stripe et ne peut pas recevoir de dons",
        );
      }
      if (!givingUser.stripeAccountId) {
        throw new Error(
          "L'utilisateur envoyant le don n'a pas de compte Stripe et ne peut pas recevoir de dons",
        );
      }
      const stripeAccount = await this.stripe.accounts.retrieve(
        receivingUser.stripeAccountId,
      );

      let { stripeProductId } = receivingUser;

      if (!stripeProductId) {
        const product = await this.stripe.products.create({
          name: `Soutenez ${receivingUser.firstName}`,
        });

        await this.prisma.user.update({
          where: {
            id: receivingUser.id,
          },
          data: {
            stripeProductId: product.id,
          },
        });
        stripeProductId = product.id;
      }

      const price = await this.stripe.prices.create({
        currency: 'EUR',
        custom_unit_amount: {
          enabled: true,
        },
        product: stripeProductId,
      });

      const createdDonation = await this.prisma.donation.create({
        data: {
          stripePriceId: price.id,
          stripeProductId: stripeProductId,
          receivingUser: {
            connect: {
              id: givingUser.id,
            },
          },
          givingUser: {
            connect: {
              id: receivingUser.id,
            },
          },
        },
      });

      const session = await this.stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            price: price.id,
            quantity: 1,
          },
        ],
        payment_intent_data: {
          application_fee_amount: 0,
          metadata: {
            donationId: createdDonation.id,
          },
          transfer_data: {
            destination: stripeAccount.id,
          },
        },
        success_url: 'http://localhost:3000',
        cancel_url: 'http://localhost:3000',
      });

      return {
        sessionUrl: session.url,
        error: false,
        message: 'La session a bien été créée.',
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          error: true,
          message: error.message,
          sessionUrl: null,
        };
      }
    }
  }

  async handleWebhooks({
    request,
  }: {
    request: RawBodyRequest<Request>;
  }): Promise<{ error: boolean; message: string }> {
    try {
      const sig = request.headers['stripe-signature'];

      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!endpointSecret) {
        throw new Error('The endpoint secret is not defined');
      }

      const event = this.stripe.webhooks.constructEvent(
        request.rawBody,
        sig,
        endpointSecret,
      );

      // Handle the event
      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntentSucceeded = event.data.object;
          // Then define and call a function to handle the event payment_intent.succeeded
          const amount = paymentIntentSucceeded.amount;
          const donationId = paymentIntentSucceeded.metadata.donationId;

          console.log({ donationId, amount });
          await this.prisma.donation.update({
            where: {
              id: donationId,
            },
            data: {
              amount: amount,
            },
          });

          break;
        // ... handle other event types
        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      // Return a 200 response to acknowledge receipt of the event
      return {
        error: false,
        message: 'Webhook handled successfully',
      };
    } catch (err) {
      console.error(`Webhook Error: ${err.message}`);
      return {
        error: true,
        message: `Webhook Error: ${err.message}`,
      };
    }
  }
}
