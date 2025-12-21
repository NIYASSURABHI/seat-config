import { Resend } from 'resend';

type VercelRequest = { method?: string; body?: any };
type VercelResponse = { status: (code: number) => { json: (body: any) => void } };
declare const process: any;

const resend = new Resend(process?.env?.RESEND_API_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const {
    fullName,
    organisation,
    email,
    phone,
    hearAbout,
    contactMethod,
    tellMore,
    seatType,
    riderType,
    color,
    features,
  } = req.body || {};

  if (!fullName || !email || !seatType) return res.status(400).json({ error: 'Missing fields' });

  const html = `
    <h2>AAE Seat Configurator</h2>
    <p><b>${seatType}${riderType ? ' / ' + riderType : ''}</b></p>
    <h3>Customer</h3>
    <ul>
      <li><b>Name:</b> ${fullName}</li>
      <li><b>Org:</b> ${organisation || '-'}</li>
      <li><b>Email:</b> ${email}</li>
      <li><b>Phone:</b> ${phone || '-'}</li>
    </ul>
    <h3>Selection</h3>
    <ul>
      <li><b>Colour:</b> ${color || '-'}</li>
      <li><b>Options:</b> ${
        Array.isArray(features) && features.length ? features.join(', ') : 'None'
      }</li>
    </ul>
    ${tellMore ? `<h3>Notes</h3><p>${(tellMore + '').replace(/\n/g, '<br/>')}</p>` : ''}
  `;

  const { error } = await resend.emails.send({
    from: process?.env?.FROM_EMAIL,
    to: process?.env?.TO_EMAIL,
    replyTo: email,
    subject: `Seat Configurator – ${seatType}${riderType ? ' / ' + riderType : ''}`,
    html,
  });
  if (error) return res.status(502).json({ error: error.message });
  res.status(200).json({ ok: true });
}
