import { IsString } from 'class-validator';

export class CreateConversationDto {
  @IsString({
    message: "Vous devez spécifier l'utilisateur.",
  })
  recipientId: string;
}
