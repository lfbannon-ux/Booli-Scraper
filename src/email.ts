import nodemailer from 'nodemailer';
import type { BooliSnapshot } from './database';

interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  toEmail: string;
}

export function getEmailConfig(): EmailConfig {
  const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'FROM_EMAIL', 'TO_EMAIL'];
  const missing = requiredVars.filter(v => !process.env[v]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    smtpHost: process.env.SMTP_HOST!,
    smtpPort: parseInt(process.env.SMTP_PORT!, 10),
    smtpUser: process.env.SMTP_USER!,
    smtpPass: process.env.SMTP_PASS!,
    fromEmail: process.env.FROM_EMAIL!,
    toEmail: process.env.TO_EMAIL!,
  };
}

function generateHtmlTable(snapshots: BooliSnapshot[]): string {
  if (snapshots.length === 0) {
    return '<p>No data available for this period.</p>';
  }

  const rows = snapshots.map(snapshot => `
    <tr>
      <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${snapshot.date}</td>
      <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${snapshot.forSale.toLocaleString()}</td>
      <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${snapshot.soonToBeSold.toLocaleString()}</td>
      <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${snapshot.hemnetForSale ? snapshot.hemnetForSale.toLocaleString() : '-'}</td>
      <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${snapshot.hemnetComing ? snapshot.hemnetComing.toLocaleString() : '-'}</td>
    </tr>
  `).join('');

  return `
    <table style="border-collapse: collapse; width: 100%; max-width: 800px; margin: 20px auto; font-family: Arial, sans-serif;">
      <thead>
        <tr style="background-color: #4CAF50; color: white;">
          <th style="border: 1px solid #ddd; padding: 12px; text-align: center;" rowspan="2">Date</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: center;" colspan="2">Booli</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: center;" colspan="2">Hemnet</th>
        </tr>
        <tr style="background-color: #4CAF50; color: white;">
          <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">For Sale</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Coming</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">For Sale</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Coming</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function generateTextTable(snapshots: BooliSnapshot[]): string {
  if (snapshots.length === 0) {
    return 'No data available for this period.';
  }

  const header = 'Date       | Booli For Sale | Booli Coming | Hemnet For Sale | Hemnet Coming\n' +
                 '-----------|----------------|--------------|-----------------|---------------';
  const rows = snapshots.map(snapshot =>
    `${snapshot.date} | ${snapshot.forSale.toString().padStart(14)} | ${snapshot.soonToBeSold.toString().padStart(12)} | ${(snapshot.hemnetForSale || 0).toString().padStart(15)} | ${(snapshot.hemnetComing || 0).toString().padStart(13)}`
  ).join('\n');

  return `${header}\n${rows}`;
}

export async function sendWeeklyReport(snapshots: BooliSnapshot[]): Promise<void> {
  const config = getEmailConfig();

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });

  const startDate = snapshots.length > 0 ? snapshots[0].date : 'N/A';
  const endDate = snapshots.length > 0 ? snapshots[snapshots.length - 1].date : 'N/A';

  const subject = `Booli & Hemnet Weekly Report (${startDate} to ${endDate})`;

  const htmlContent = `
    <html>
      <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 800px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h1 style="color: #333; text-align: center;">Booli & Hemnet Weekly Housing Report</h1>
          <p style="color: #666; text-align: center; font-size: 16px;">
            Data from ${startDate} to ${endDate}
          </p>
          ${generateHtmlTable(snapshots)}
          <div style="margin-top: 30px; padding: 15px; background-color: #f9f9f9; border-radius: 5px;">
            <p style="color: #666; font-size: 14px; margin: 0;">
              <strong>Source:</strong> <a href="https://www.booli.se/sok/till-salu" style="color: #4CAF50;">https://www.booli.se/sok/till-salu</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `
Booli & Hemnet Weekly Housing Report
Data from ${startDate} to ${endDate}

${generateTextTable(snapshots)}

Sources: 
- Booli: https://www.booli.se/sok/till-salu
- Hemnet: https://www.hemnet.se/bostader
  `;

  const info = await transporter.sendMail({
    from: config.fromEmail,
    to: config.toEmail,
    subject,
    text: textContent,
    html: htmlContent,
  });

  console.log('Email sent successfully:', info.messageId);
}
