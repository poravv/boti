import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

export class EmailService {
  constructor(private prisma: PrismaClient) {}

  private async getConfig(): Promise<Record<string, string>> {
    const rows = await this.prisma.systemConfig.findMany({
      where: { key: { in: ['smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from_email','smtp_from_name','smtp_secure'] } },
    });
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }

  async sendMail(opts: { to: string; subject: string; html: string }): Promise<void> {
    const cfg = await this.getConfig();
    if (!cfg.smtp_host || !cfg.smtp_user || !cfg.smtp_pass) {
      console.warn('[EmailService] SMTP not configured — skipping email to', opts.to);
      return;
    }
    const transporter = nodemailer.createTransport({
      host: cfg.smtp_host,
      port: Number(cfg.smtp_port || '587'),
      secure: cfg.smtp_secure === 'true',
      auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
    });
    await transporter.sendMail({
      from: `"${cfg.smtp_from_name || 'Boti'}" <${cfg.smtp_from_email || cfg.smtp_user}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
  }

  async sendWelcome(to: string, ownerName: string, orgName: string, trialDays: number): Promise<void> {
    await this.sendMail({
      to,
      subject: `¡Bienvenido a Boti, ${ownerName}! 🤖`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0b1c30">
          <h2 style="color:#006b5f">¡Hola ${ownerName}!</h2>
          <p>Tu organización <strong>${orgName}</strong> fue creada exitosamente en Boti.</p>
          <p>Tenés <strong>${trialDays} días de prueba gratuita</strong> para explorar todas las funcionalidades.</p>
          <p>Si necesitás ayuda o querés conocer los planes disponibles, respondé este email o escribinos por WhatsApp.</p>
          <hr style="border:none;border-top:1px solid #e5eeff;margin:24px 0"/>
          <p style="font-size:12px;color:#71787c">Boti — Automatización de WhatsApp</p>
        </div>`,
    });
  }

  async sendAdminNewOrg(adminEmail: string, orgName: string, ownerName: string, ownerEmail: string, trialDays: number): Promise<void> {
    await this.sendMail({
      to: adminEmail,
      subject: `🆕 Nueva organización registrada: ${orgName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0b1c30">
          <h2 style="color:#006b5f">Nueva organización en Boti</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:6px 0;font-weight:bold">Organización:</td><td>${orgName}</td></tr>
            <tr><td style="padding:6px 0;font-weight:bold">Dueño:</td><td>${ownerName}</td></tr>
            <tr><td style="padding:6px 0;font-weight:bold">Email:</td><td>${ownerEmail}</td></tr>
            <tr><td style="padding:6px 0;font-weight:bold">Trial:</td><td>${trialDays} días</td></tr>
            <tr><td style="padding:6px 0;font-weight:bold">Fecha:</td><td>${new Date().toLocaleString('es-PY',{timeZone:'America/Asuncion'})}</td></tr>
          </table>
          <p>Ingresá al <a href="https://mindtechpy.net">panel SuperAdmin</a> para asignar un plan.</p>
        </div>`,
    });
  }

  async sendTrialExpiring(to: string, ownerName: string, orgName: string, expiresAt: Date): Promise<void> {
    const dateStr = expiresAt.toLocaleDateString('es-PY', { timeZone: 'America/Asuncion', day: '2-digit', month: 'long', year: 'numeric' });
    await this.sendMail({
      to,
      subject: `⏰ Tu trial de Boti vence en 3 días`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0b1c30">
          <h2 style="color:#D97706">Tu período de prueba está por vencer</h2>
          <p>Hola ${ownerName}, el trial de <strong>${orgName}</strong> vence el <strong>${dateStr}</strong>.</p>
          <p>Para continuar usando Boti sin interrupciones, contactanos para asignarte un plan.</p>
          <p>Respondé este email o escribinos por WhatsApp al +595 981 586823.</p>
          <hr style="border:none;border-top:1px solid #e5eeff;margin:24px 0"/>
          <p style="font-size:12px;color:#71787c">Boti — Automatización de WhatsApp</p>
        </div>`,
    });
  }

  async sendAdminPlanRequest(adminEmail: string, orgName: string, ownerEmail: string, desiredPlan: string, notes: string): Promise<void> {
    await this.sendMail({
      to: adminEmail,
      subject: `📋 Solicitud de upgrade: ${orgName} → ${desiredPlan}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0b1c30">
          <h2 style="color:#006b5f">Solicitud de upgrade de plan</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:6px 0;font-weight:bold">Organización:</td><td>${orgName}</td></tr>
            <tr><td style="padding:6px 0;font-weight:bold">Email:</td><td>${ownerEmail}</td></tr>
            <tr><td style="padding:6px 0;font-weight:bold">Plan solicitado:</td><td>${desiredPlan}</td></tr>
            <tr><td style="padding:6px 0;font-weight:bold">Notas:</td><td>${notes || '—'}</td></tr>
          </table>
          <p>Ingresá al <a href="https://mindtechpy.net">panel SuperAdmin</a> para asignar el plan.</p>
        </div>`,
    });
  }

  async sendPlanAssigned(to: string, ownerName: string, planName: string): Promise<void> {
    await this.sendMail({
      to,
      subject: `✅ Tu plan de Boti fue actualizado a ${planName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0b1c30">
          <h2 style="color:#006b5f">Plan actualizado</h2>
          <p>Hola ${ownerName}, tu plan fue actualizado a <strong>${planName}</strong>.</p>
          <p>Ya podés aprovechar todas las funcionalidades incluidas en tu nuevo plan.</p>
          <p>¿Tenés dudas? Escribinos por WhatsApp al +595 981 586823.</p>
          <hr style="border:none;border-top:1px solid #e5eeff;margin:24px 0"/>
          <p style="font-size:12px;color:#71787c">Boti — Automatización de WhatsApp</p>
        </div>`,
    });
  }
}
