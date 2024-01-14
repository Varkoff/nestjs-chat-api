import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetUserPasswordDto {
  @IsNotEmpty()
  @MinLength(6, {
    message: 'Votre mot de passe doit faire plus de 8 charactères.',
  })
  password: string;

  @IsString({
    message: 'Vous devez fournir un token.',
  })
  token: string;
}
