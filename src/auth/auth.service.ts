import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createId } from '@paralleldrive/cuid2';
import { compare, hash } from 'bcrypt';
import { MailerService } from 'src/mailer.service';
import { PrismaService } from 'src/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LogUserDto } from './dto/log-user.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UserPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
  ) {}
  async login({ authBody }: { authBody: LogUserDto }) {
    try {
      const { email, password } = authBody;

      const existingUser = await this.prisma.user.findUnique({
        where: {
          email,
        },
      });

      if (!existingUser) {
        throw new Error("L'utilisateur n'existe pas.");
      }

      const isPasswordValid = await this.isPasswordValid({
        password,
        hashedPassword: existingUser.password,
      });

      if (!isPasswordValid) {
        throw new Error('Le mot de passe est invalide.');
      }
      return this.authenticateUser({
        userId: existingUser.id,
      });
    } catch (error) {
      return { error: true, message: error.message };
    }
  }

  async register({ registerBody }: { registerBody: CreateUserDto }) {
    try {
      const { email, firstName, password } = registerBody;

      const existingUser = await this.prisma.user.findUnique({
        where: {
          email,
        },
      });

      if (existingUser) {
        throw new Error('Un compte existe déjà à cette adresse email.');
      }

      const hashedPassword = await this.hashPassword({ password });

      const createdUser = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
        },
      });

      await this.mailerService.sendCreatedAccountEmail({
        firstName,
        recipient: email,
      });

      return this.authenticateUser({
        userId: createdUser.id,
      });
    } catch (error) {
      return {
        error: true,
        message: error.message,
      };
    }
  }

  private async hashPassword({ password }: { password: string }) {
    const hashedPassword = await hash(password, 10);
    return hashedPassword;
  }
  private async isPasswordValid({
    password,
    hashedPassword,
  }: {
    password: string;
    hashedPassword: string;
  }) {
    const isPasswordValid = await compare(password, hashedPassword);
    return isPasswordValid;
  }

  private authenticateUser({ userId }: UserPayload) {
    const payload: UserPayload = { userId };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async resetUserPasswordRequest({ email }: { email: string }) {
    try {
      const existingUser = await this.prisma.user.findUnique({
        where: {
          email,
        },
      });

      if (!existingUser) {
        throw new Error("L'utilisateur n'existe pas.");
      }

      if (existingUser.isResettingPassword === true) {
        throw new Error(
          'Une demande de réinitialisation de mot de passe est déjà en cours.',
        );
      }

      const createdId = createId();
      await this.prisma.user.update({
        where: {
          email,
        },
        data: {
          isResettingPassword: true,
          resetPasswordToken: createdId,
        },
      });
      await this.mailerService.sendRequestedPasswordEmail({
        firstName: existingUser.firstName,
        recipient: existingUser.email,
        token: createdId,
      });

      return {
        error: false,
        message:
          'Veuillez consulter vos emails pour réinitialiser votre mot de passe.',
      };
      // return this.authenticateUser({
      //   userId: existingUser.id,
      // });
    } catch (error) {
      return { error: true, message: error.message };
    }
  }

  async verifyResetPasswordToken({ token }: { token: string }) {
    try {
      const existingUser = await this.prisma.user.findUnique({
        where: {
          resetPasswordToken: token,
        },
      });

      if (!existingUser) {
        throw new Error("L'utilisateur n'existe pas.");
      }

      if (existingUser.isResettingPassword === false) {
        throw new Error(
          "Aucune demande de réinitialisation de mot de passe n'est en cours.",
        );
      }

      return {
        error: false,
        message: 'Le token est valide et peut être utilisé.',
      };
      // return this.authenticateUser({
      //   userId: existingUser.id,
      // });
    } catch (error) {
      return { error: true, message: error.message };
    }
  }

  async resetUserPassword({
    resetPasswordDto,
  }: {
    resetPasswordDto: ResetUserPasswordDto;
  }) {
    try {
      const { password, token } = resetPasswordDto;
      const existingUser = await this.prisma.user.findUnique({
        where: {
          resetPasswordToken: token,
        },
      });

      if (!existingUser) {
        throw new Error("L'utilisateur n'existe pas.");
      }

      if (existingUser.isResettingPassword === false) {
        throw new Error(
          "Aucune demande de réinitialisation de mot de passe n'est en cours.",
        );
      }

      const hashedPassword = await this.hashPassword({
        password,
      });
      await this.prisma.user.update({
        where: {
          resetPasswordToken: token,
        },
        data: {
          isResettingPassword: false,
          password: hashedPassword,
        },
      });

      return {
        error: false,
        message: 'Votre mot de passe a bien été changé.',
      };
      // return this.authenticateUser({
      //   userId: existingUser.id,
      // });
    } catch (error) {
      return { error: true, message: error.message };
    }
  }
}
