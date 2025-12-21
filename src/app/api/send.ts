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
    quantity,
    requestType,
  } = req.body || {};

  if (!fullName || !email || !seatType) return res.status(400).json({ error: 'Missing fields' });

  const reqLabel =
    requestType === 'ga' ? 'GA Drawing' : requestType === 'quote' ? 'Quote' : 'Submit';

  const html = `
    <h2>Request: ${reqLabel}</h2>
    <h3>Customer Details:</h3>
    <p>Name: ${fullName || '-'}</p>
    <p>Organisation: ${organisation || '-'}</p>
    <p>Mail Address: ${email || '-'}</p>
    <p>Phone Number: ${phone || '-'}</p>
    <p>How did you hear about us: ${hearAbout || '-'}</p>
    <p>Preferred Contact Method: ${contactMethod || '-'}</p>

    <h3>Specification:</h3>
    <p>Type: ${seatType}</p>
    <p>Variant: ${riderType || '-'}</p>
    ${(Array.isArray(features) && features.length ? features : ['None'])
      .map((f: string) => `<p>${f}</p>`)
      .join('')}
    <p>Colour: ${color || '-'}</p>
    <p>Quantity: ${quantity ?? '-'}</p>
    <p>Optional Comments: ${tellMore ? (tellMore + '').replace(/\n/g, '<br/>') : '-'}</p>
  `;

  const { error } = await resend.emails.send({
    from: process?.env?.FROM_EMAIL,
    to: process?.env?.TO_EMAIL,
    replyTo: email,
    subject: `Seat Configurator – ${reqLabel} – ${seatType}${riderType ? ' / ' + riderType : ''}`,
    html,
  });
  if (error) return res.status(502).json({ error: error.message });
  res.status(200).json({ ok: true });
}
