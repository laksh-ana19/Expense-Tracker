const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const CATEGORIES = require('../utils/categories');

router.use(authMiddleware);

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

// POST /api/receipts/scan — sends a compressed receipt photo to Gemini's free
// vision API and returns { amount, date, category, note }. Unlike the old
// OCR + regex approach, the model reads the bill semantically — it knows to
// return the FINAL total after any discount, not just the first "total"-ish
// line it sees, and it can pick a real category from the merchant/items
// instead of keyword-matching.
router.post('/scan', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        message: 'Receipt scanning is not configured. Add GEMINI_API_KEY to backend/.env (free key from https://aistudio.google.com/apikey).',
      });
    }

    const { imageDataUrl } = req.body;
    const match = typeof imageDataUrl === 'string' && imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ message: 'A valid receipt image is required.' });
    }
    const [, mimeType, base64Data] = match;

    const prompt = `You are reading a photo of a shopping/expense receipt or bill.

Return the FINAL amount the person actually paid. Bills often show a subtotal,
then a discount/coupon/offer line, then a final total — in that case use the
final total after the discount, never the subtotal.

Pick exactly one category from this list that best matches the purchase
(return the value exactly as written, nothing else): ${CATEGORIES.join(', ')}.

Also return the transaction date in strict YYYY-MM-DD format if it is visible,
and the merchant/store name if visible.

If a field genuinely is not visible or not determinable from the image, return
null for that field instead of guessing.`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: base64Data } },
            ],
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                amount: { type: 'NUMBER', nullable: true },
                date: { type: 'STRING', nullable: true },
                category: { type: 'STRING', enum: CATEGORIES, nullable: true },
                merchant: { type: 'STRING', nullable: true },
              },
            },
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => '');
      console.error('Gemini receipt scan failed:', geminiRes.status, errText);
      return res.status(502).json({ message: 'Receipt scanning service is unavailable right now. Please try again or fill in the details yourself.' });
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return res.status(502).json({ message: 'Could not read a response from the scanning service.' });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return res.status(502).json({ message: 'Scanning service returned an unexpected format.' });
    }

    const amount = typeof parsed.amount === 'number' && parsed.amount > 0 ? parsed.amount : null;

    let date = typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null;
    if (date && new Date(date).getTime() > Date.now() + 24 * 60 * 60 * 1000) {
      date = null; // ignore obviously-future misreads
    }

    const category = CATEGORIES.includes(parsed.category) ? parsed.category : null;
    const note = typeof parsed.merchant === 'string' ? parsed.merchant.trim().slice(0, 80) : '';

    res.json({ amount, date, category, note });
  } catch (err) {
    console.error('Receipt scan error:', err);
    res.status(500).json({ message: 'Receipt scanning failed.', error: err.message });
  }
});

module.exports = router;
