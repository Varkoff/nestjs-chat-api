import { Injectable } from '@nestjs/common';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { fileSchema } from 'src/file-utils';
import { PrismaService } from 'src/prisma.service';
import { StripeService } from 'src/stripe/stripe.service';
import { z } from 'zod';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly awsS3Service: AwsS3Service,
    private readonly stripe: StripeService,
  ) {}
  async getUsers() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        avatarFileKey: true,
      },
    });

    const usersWithAvatar = await Promise.all(
      users.map(async (user) => {
        let avatarUrl = '';
        if (user.avatarFileKey) {
          avatarUrl = await this.awsS3Service.getFileUrl({
            fileKey: user.avatarFileKey,
          });
        }
        return { ...user, avatarUrl };
      }),
    );

    return usersWithAvatar;
  }

  async getUser({ userId }: { userId: string }) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        avatarFileKey: true,
        stripeAccountId: true,
      },
    });
    let avatarUrl = '';
    if (user.avatarFileKey) {
      avatarUrl = await this.awsS3Service.getFileUrl({
        fileKey: user.avatarFileKey,
      });
    }
    let canReceiveMoney = false;
    if (user.stripeAccountId) {
      const stripeAccountData = await this.stripe.getStripeAccount({
        stripeAccountId: user.stripeAccountId,
      });
      canReceiveMoney = stripeAccountData.canReceiveMoney;
    }
    return { ...user, avatarUrl, canReceiveMoney };
  }

  async updateUser({
    userId,
    submittedFile,
  }: {
    userId: string;
    submittedFile: z.infer<typeof fileSchema>;
  }) {
    try {
      const existingUser = await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          avatarFileKey: true,
        },
      });
      if (!existingUser) {
        throw new Error("L'utilisateur n'existe pas");
      }

      const { fileKey } = await this.awsS3Service.uploadFile({
        file: submittedFile,
      });

      await this.prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          avatarFileKey: fileKey,
        },
      });

      if (existingUser.avatarFileKey) {
        await this.awsS3Service.deleteFile({
          fileKey: existingUser.avatarFileKey,
        });
      }
      return {
        error: false,
        message: "L'avatar a bien été mis à jour",
      };
    } catch (error) {
      if (error instanceof Error) {
        return { error: true, message: error.message };
      }
      return { error: true, message: 'Une erreur inattendue est survenue' };
    }
  }
}
