import { Injectable } from '@nestjs/common';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { PrismaService } from 'src/prisma.service';
import { SocketService } from 'src/socket/socket.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendChatDto } from './dto/send-chat.dto';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly socketService: SocketService,
    private readonly awsS3Service: AwsS3Service,
  ) {}

  async createConversation({
    createConversationDto: { recipientId },
    userId,
  }: {
    createConversationDto: CreateConversationDto;
    userId: string;
  }) {
    try {
      const [existingRecipient, existingUser] = await Promise.all([
        this.prisma.user.findUnique({
          where: {
            id: recipientId,
          },
        }),
        this.prisma.user.findUnique({
          where: {
            id: userId,
          },
        }),
      ]);
      if (!existingRecipient) {
        throw new Error("L'utilisateur sélectionné n'existe pas.");
      }

      if (!existingUser) {
        throw new Error("L'utilisateur n'existe pas.");
      }
      const createdConversation = await this.prisma.conversation.create({
        data: {
          users: {
            connect: [
              {
                id: existingUser.id,
              },
              {
                id: existingRecipient.id,
              },
            ],
          },
        },
      });

      return {
        error: false,
        conversationId: createdConversation.id,
        message: 'La conversation a bien été créée.',
      };
    } catch (error) {
      console.error(error);
      return {
        error: true,
        message: error.message,
      };
    }
  }

  async sendChat({
    sendChatDto,
    conversationId,
    senderId,
  }: {
    sendChatDto: SendChatDto;
    conversationId: string;
    senderId: string;
  }) {
    try {
      const [existingConversation, existingUser] = await Promise.all([
        this.prisma.conversation.findUnique({
          where: {
            id: conversationId,
          },
        }),
        this.prisma.user.findUnique({
          where: {
            id: senderId,
          },
        }),
      ]);
      if (!existingConversation) {
        throw new Error("La conversation n'existe pas.");
      }

      if (!existingUser) {
        throw new Error("L'utilisateur n'existe pas.");
      }
      const updatedConversation = await this.prisma.conversation.update({
        where: {
          id: existingConversation.id,
        },
        data: {
          messages: {
            create: {
              content: sendChatDto.content,
              sender: {
                connect: {
                  id: existingUser.id,
                },
              },
            },
          },
        },
        select: {
          id: true,
          messages: {
            select: {
              content: true,
              id: true,
              sender: {
                select: {
                  id: true,
                  firstName: true,
                },
              },
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });
      // Envoi d'une notification à l'utilisateur ayant reçu le message
      this.socketService.server
        .to(updatedConversation.id)
        .emit('send-chat-update', updatedConversation.messages);
      console.log(updatedConversation);

      return {
        error: false,
        message: 'Votre message a bien été envoyé.',
      };
    } catch (error) {
      console.error(error);
      return {
        error: true,
        message: error.message,
      };
    }
  }

  async getConversations({ userId }: { userId: string }) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        conversations: {
          select: {
            id: true,
            updatedAt: true,
            users: {
              select: {
                id: true,
                firstName: true,
                avatarFileKey: true,
              },
            },
            messages: {
              select: {
                content: true,
                id: true,
                sender: {
                  select: {
                    id: true,
                    firstName: true,
                  },
                },
              },
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
            },
          },
          orderBy: {
            updatedAt: 'desc',
          },
        },
      },
    });
    if (!existingUser) {
      throw new Error("L'utilisateur n'existe pas.");
    }
    const conversationsWithAvatars = await Promise.all(
      existingUser.conversations.map(async (conversation) => {
        return {
          ...conversation,
          users: await Promise.all(
            conversation.users.map(async (user) => {
              let avatarUrl = '';
              if (user.avatarFileKey) {
                avatarUrl = await this.awsS3Service.getFileUrl({
                  fileKey: user.avatarFileKey,
                });
              }
              return { ...user, avatarUrl };
            }),
          ),
        };
      }),
    );

    return conversationsWithAvatars;
  }

  async getConversation({
    userId,
    conversationId,
  }: {
    userId: string;
    conversationId: string;
  }) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
    if (!existingUser) {
      throw new Error("L'utilisateur n'existe pas.");
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },
      select: {
        id: true,
        updatedAt: true,
        users: {
          select: {
            firstName: true,
            id: true,
            avatarFileKey: true,
            receivedDonations: {
              select: {
                amount: true,
                id: true,
                createdAt: true,
              },
              where: {
                givingUserId: existingUser.id,
              },
            },
            givenDonations: {
              select: {
                amount: true,
                id: true,
                createdAt: true,
              },
              where: {
                receivingUserId: existingUser.id,
              },
            },
          },
        },
        messages: {
          select: {
            content: true,
            id: true,
            sender: {
              select: {
                id: true,
                firstName: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
    if (!conversation) {
      throw new Error("Cette conversation n'existe pas.");
    }

    const conversationWithAvatars = {
      ...conversation,
      users: await Promise.all(
        conversation.users.map(async (user) => {
          let avatarUrl = '';
          if (user.avatarFileKey) {
            avatarUrl = await this.awsS3Service.getFileUrl({
              fileKey: user.avatarFileKey,
            });
          }
          return { ...user, avatarUrl };
        }),
      ),
    };
    return conversationWithAvatars;
  }
}
