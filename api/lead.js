export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, phone, email, city, service, message } = req.body || {};
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' });

  const GHL_KEY = process.env.GHL_API_KEY;
  const LOCATION_ID = process.env.GHL_LOCATION_ID;

  try {
    const payload = {
      firstName: name.split(' ')[0],
      lastName: name.split(' ').slice(1).join(' ') || '',
      phone,
      email: email || undefined,
      address1: city || undefined,
      locationId: LOCATION_ID,
      source: 'Crystal Air Website',
      tags: ['crystal-air-lead', 'duct-cleaning', service ? service.toLowerCase().replace(/\s+/g, '-') : 'inspection-request'],
      customFields: [
        { key: 'service_requested', field_value: service || 'Free Inspection' },
        { key: 'message', field_value: message || '' },
        { key: 'city', field_value: city || '' },
      ]
    };

    const ghlRes = await fetch(`https://services.leadconnectorhq.com/contacts/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GHL_KEY}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      },
      body: JSON.stringify(payload)
    });

    const ghlData = await ghlRes.json();
    if (!ghlRes.ok) {
      console.error('GHL error:', ghlData);
      return res.status(500).json({ error: 'Failed to create contact' });
    }

    // Also try to add to pipeline as opportunity
    const contactId = ghlData.contact?.id;
    if (contactId) {
      await fetch(`https://services.leadconnectorhq.com/opportunities/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GHL_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        },
        body: JSON.stringify({
          pipelineId: process.env.GHL_PIPELINE_ID || '',
          locationId: LOCATION_ID,
          contactId,
          name: `${name} — Duct Cleaning (${city || 'South FL'})`,
          status: 'open',
          source: 'Crystal Air Website'
        })
      }).catch(() => {}); // non-fatal
    }

    return res.status(200).json({ ok: true, contactId });
  } catch (err) {
    console.error('Lead handler error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
