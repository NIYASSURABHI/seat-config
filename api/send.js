const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async function handler(req, res) {
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
    requestTypes,
  } = req.body || {};

  if (!fullName || !email || !seatType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const labels =
    Array.isArray(requestTypes) && requestTypes.length
      ? requestTypes.map((r) => (r === 'ga' ? 'GA Drawing' : 'Quote'))
      : [];
  const reqLabel = labels.length ? labels.join(' + ') : 'No requests';

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
      .map((f) => `<p>${f}</p>`)
      .join('')}
    <p>Colour: ${color || '-'}</p>
    <p>Quantity: ${quantity ?? '-'}</p>
    <p>Optional Comments: ${tellMore ? String(tellMore).replace(/\n/g, '<br/>') : '-'}</p>
  `;

  const { error } = await resend.emails.send({
    from: process.env.FROM_EMAIL,
    to: process.env.TO_EMAIL,
    replyTo: email,
    subject: `Seat Configurator – ${reqLabel} – ${seatType}${riderType ? ' / ' + riderType : ''}`,
    html,
  });

  if (error) return res.status(502).json({ error: error.message });
  return res.status(200).json({ ok: true });
};
