const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

function parseEmails(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function toFamily(seatType) {
  const v = String(seatType || '').trim().toLowerCase();
  return v === 'crewrider' ? 'crewrider' : 'blastrider';
}

function toRider(riderType) {
  return String(riderType || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function specVariant(family, rider) {
  if (!rider) return '-';
  if (family === 'blastrider') return rider === 'crew' ? 'Crew' : 'Driver/Commander';
  return rider === 'light_weight' ? 'Crew (Light Weight)' : 'Driver/Commander';
}

function specMountType(family, rider) {
  if (!rider) return '-';
  if (family === 'blastrider' && rider === 'crew') return 'Base / Vertical / Overhead Bracket';
  if (family === 'crewrider' && rider === 'light_weight') return 'Vertical Bracket';
  return 'Base Bracket';
}

function specSeatBelt(family, rider) {
  if (!rider) return '-';
  if (family === 'crewrider' && rider === 'light_weight') return '4 point';
  return '5 point';
}

function specFabric(family, rider) {
  if (!rider) return '-';
  if (family === 'crewrider' && rider === 'light_weight') return 'Nylon 1000d';
  return 'PU Coated Nylon 1000d';
}

function specColour(color) {
  const c = String(color || '').toLowerCase();
  if (c === 'black') return 'BLACK - CODE 17';
  if (c === 'green') return 'GREEN - CODE 4M';
  if (c === 'tan') return 'TAN - CODE 2A';
  return (color || '-').toString().toUpperCase();
}

function selectedOptionsForSpec(features, family, rider) {
  const values = Array.isArray(features) ? features.map((f) => String(f).toLowerCase()) : [];
  if (values.length === 0) return ['None'];

  const labels = [];
  const hasHead = values.includes('headrest');
  const hasWhip = values.includes('whiplash_bar');

  if (family === 'crewrider' && rider === 'light_weight' && (hasHead || hasWhip)) {
    labels.push('Headrest + Whiplash Bar');
  } else {
    if (hasHead) labels.push('Headrest');
    if (hasWhip) labels.push('Whiplash Bar');
  }

  if (values.includes('armrest')) labels.push('Armrest');
  if (values.includes('footrest')) labels.push('Footrest');
  if (values.includes('bms')) labels.push('BMS');

  return labels.length ? labels : ['None'];
}

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
  const toRecipients = parseEmails(process.env.TO_EMAILS);
  const ccRecipients = parseEmails(process.env.CC_EMAILS);

  if (toRecipients.length === 0) {
    return res.status(500).json({ error: 'Recipient configuration missing: TO_EMAILS' });
  }

  const family = toFamily(seatType);
  const rider = toRider(riderType);
  const options = selectedOptionsForSpec(features, family, rider);

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5;">
      <h2 style="margin:0 0 12px;">Request: ${reqLabel}</h2>

      <h3 style="margin:16px 0 8px;">Customer Details:</h3>
      <p><strong>Name:</strong> ${fullName || '-'}</p>
      <p><strong>Organisation:</strong> ${organisation || '-'}</p>
      <p><strong>Mail Address:</strong> ${email || '-'}</p>
      <p><strong>Phone Number:</strong> ${phone || '-'}</p>
      <p><strong>How did you hear about us:</strong> ${hearAbout || '-'}</p>
      <p><strong>Preferred Contact Method:</strong> ${contactMethod || '-'}</p>

      <h3 style="margin:16px 0 8px;">Specification:</h3>
      <p><strong>Type:</strong> ${seatType || '-'}</p>
      <p><strong>Variant:</strong> ${specVariant(family, rider)}</p>
      <p><strong>Selected Options</strong></p>
      <ul style="margin:6px 0 10px 20px;">
        ${options.map((item) => `<li>${item}</li>`).join('')}
      </ul>
      <p><strong>Mount Type:</strong> ${specMountType(family, rider)}</p>
      <p><strong>Seat Belt:</strong> ${specSeatBelt(family, rider)}</p>
      <p><strong>Fabric:</strong> ${specFabric(family, rider)}</p>
      <p><strong>Colour:</strong> ${specColour(color)}</p>
      <p><strong>Quantity:</strong> ${quantity ?? '-'}</p>
      <p><strong>Optional Comments:</strong> ${
        tellMore ? String(tellMore).replace(/\n/g, '<br/>') : '-'
      }</p>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: process.env.FROM_EMAIL,
    to: toRecipients,
    cc: ccRecipients.length ? ccRecipients : undefined,
    replyTo: email,
    subject: `Seat Configurator – ${reqLabel} – ${seatType}${riderType ? ' / ' + riderType : ''}`,
    html,
  });

  if (error) return res.status(502).json({ error: error.message });
  return res.status(200).json({ ok: true });
};
