import { Resend } from 'resend';

export class MailerService {
  private readonly mailer: Resend;
  constructor() {
    this.mailer = new Resend(process.env.RESEND_API_KEY);
  }

  async sendCreatedAccountEmail({
    recipient,
    firstName,
  }: {
    recipient: string;
    firstName: string;
  }) {
    try {
      const data = await this.mailer.emails.send({
        from: 'Virgile <virgile@chat.algomax.fr>',
        to: [recipient],
        subject: 'Bienvenue sur la plateforme',
        html: `Bonjour ${firstName}, et bienvenue sur NestJS Chat ! Nous sommes <strong>heureux</strong> de vous avoir parmi nous.`,
      });

      console.log(data);
    } catch (error) {
      console.error(error);
    }
  }

  async sendRequestedPasswordEmail({
    recipient,
    firstName,
    token,
  }: {
    recipient: string;
    firstName: string;
    token: string;
  }) {
    try {
      const link = `${process.env.FRONTEND_URL}/forgot-password?token=${token}`;
      const data = await this.mailer.emails.send({
        from: 'Acme <onboarding@resend.dev>',
        to: [recipient],
        subject: 'Pour réinitialiser votre mot de passe ...',
        html: `Bonjour ${firstName}, voici votre lien de réinitialisation de mot de passe : ${link}`,
      });

      console.log(data);
    } catch (error) {
      console.error(error);
    }
  }
}
