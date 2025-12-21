import 'dotenv/config';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const html = `<h2>Seat Configurator Test</h2><p>If you see this, email works.</p>`;

const r = await resend.emails.send({
  from: process.env.FROM_EMAIL,
  to: process.env.TO_EMAIL,
  subject: 'Test Email',
  html
});

console.log('Result:', r);
