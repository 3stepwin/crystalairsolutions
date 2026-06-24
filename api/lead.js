export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, phone, email, city, service, message } = req.body || {};
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' });

  const GHL_KEY = process.env.GHL_API_KEY;
  const LOCATION_ID = process.env.GHL_LOCATION_ID;

  const nameParts = name.trim().split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ') || '';

  const serviceTag = service
    ? service.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    : 'inspection-request';

  const payload = {
    firstName,
    lastName,
    phone: phone.replace(/\D/g, '').length === 10 ? `+1${phone.replace(/\D/g, '')}` : phone,
    ...(email ? { email } : {}),
    ...(city ? { address1: city } : {}),
    locationId: LOCATION_ID,
    source: 'Crystal Air Website',
    tags: ['crystal-air-lead', 'duct-cleaning', serviceTag],
  };

  try {
    const contactRes = await fetch('https://services.leadconnectorhq.com/contacts/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GHL_KEY}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28',
      },
      body: JSON.stringify(payload),
    });

    const contactData = await contactRes.json();
    if (!contactRes.ok) {
      console.error('GHL contact error:', JSON.stringify(contactData));
      return res.status(500).json({ error: 'Failed to create contact', detail: contactData });
    }

    const contactId = contactData.contact?.id;

    // Add a note with service + message details
    if (contactId && (service || message || city)) {
      const noteBody = [
        service ? `Service requested: ${service}` : '',
        city ? `City/Area: ${city}` : '',
        message ? `Message: ${message}` : '',
      ].filter(Boolean).join('\n');

      await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GHL_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28',
        },
        body: JSON.stringify({ body: noteBody }),
      }).catch(() => {});
    }

    return res.status(200).json({ ok: true, contactId });
  } catch (err) {
    console.error('Lead handler error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
