import { IsString, MinLength } from 'class-validator';

export class SendChatDto {
  @IsString({
    message: 'Vous devez fournir un message.',
  })
  @MinLength(1, {
    message: 'Votre message doit contenir au moins un caractère.',
  })
  content: string;
}
