import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }
  const { to, subject, message } = req.body || {};
  if (!to || !subject || !message) {
    return res.status(400).json({ error: 'Champs manquants.' });
  }

  try {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      throw new Error('BREVO_API_KEY non défini dans les variables d’environnement.');
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        sender: { email: process.env.BREVO_SENDER_EMAIL || 'no-reply@example.com', name: 'GIRAS' },
        to: [{ email: to }],
        subject,
        htmlContent: `<html><body><p>${message}</p></body></html>`
      })
    });

    if (!response.ok) {
      const txt = await response.text();
      console.error('Brevo error:', txt);
      return res.status(500).json({ error: 'Erreur Brevo', details: txt });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
