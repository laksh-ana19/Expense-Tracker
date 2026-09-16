const express = require('express');
const router = express.Router();
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const Transaction = require('../models/Transaction');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

const SORT_FIELDS = { date: 'date', amount: 'amount', type: 'type', category: 'category' };

// Builds a query object shared by the list and export routes: ownership,
// optional type/category filter, and a search over note + category (feature 4).
function buildQuery(req) {
  const { type, category, search = '' } = req.query;
  const query = { userId: req.userId };
  if (type) query.type = type;
  if (category) query.category = category;
  if (search.trim()) {
    query.$or = [
      { note: { $regex: search.trim(), $options: 'i' } },
      { category: { $regex: search.trim(), $options: 'i' } },
    ];
  }
  return query;
}

// Builds a mongoose sort object. Accepts either `sortBy`/`order` (used by the
// Transaction History UI) or a raw `sort` string like `-date` (used by exports/API clients).
function buildSort(req) {
  const { sortBy, order, sort } = req.query;
  if (sort) return sort;
  const field = SORT_FIELDS[sortBy] || 'date';
  const direction = order === 'asc' ? 1 : -1;
  return { [field]: direction, _id: direction };
}

// GET /transactions — list with filter, search, sort, and pagination (REQ-3.x + features 4, 5)
router.get('/', async (req, res) => {
  try {
    const query = buildQuery(req);
    const sort = buildSort(req);

    const pageNum = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const [transactions, total] = await Promise.all([
      Transaction.find(query).sort(sort).skip(skip).limit(limitNum).lean(),
      Transaction.countDocuments(query),
    ]);

    // Full receipt images can be a few hundred KB each — fine for a single
    // record, too heavy to ship on every row of a paginated list. The list
    // only needs to know a receipt exists; the edit/view flow fetches the
    // single transaction (below) to get the actual image.
    const transactionsForList = transactions.map(({ receiptImage, ...rest }) => ({
      ...rest,
      hasReceipt: !!receiptImage,
    }));

    res.json({
      transactions: transactionsForList,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.max(Math.ceil(total / limitNum), 1),
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch transactions.', error: err.message });
  }
});

// GET /transactions/export — CSV or PDF download of the (filtered/searched) list (feature 1)
router.get('/export', async (req, res) => {
  try {
    const query = buildQuery(req);
    const format = (req.query.format || 'csv').toLowerCase();
    const transactions = await Transaction.find(query).sort('-date').lean();

    if (format === 'csv') {
      const fields = [
        { label: 'Date', value: (row) => new Date(row.date).toISOString().slice(0, 10) },
        { label: 'Type', value: 'type' },
        { label: 'Category', value: 'category' },
        { label: 'Amount', value: 'amount' },
        { label: 'Currency', value: 'currency' },
        { label: 'Note', value: 'note' },
      ];
      const parser = new Parser({ fields });
      const csv = parser.parse(transactions);
      res.header('Content-Type', 'text/csv');
      res.attachment('transactions.csv');
      return res.send(csv);
    }

    if (format === 'pdf') {
      res.header('Content-Type', 'application/pdf');
      res.attachment('transactions.pdf');

      const doc = new PDFDocument({ margin: 36, size: 'A4' });
      doc.pipe(res);

      doc.fontSize(16).text('Transaction History', { align: 'center' });
      doc.moveDown(1);

      doc.fontSize(9).fillColor('#555');
      const colX = { date: 36, type: 110, category: 170, amount: 300, currency: 380, note: 430 };
      doc.text('Date', colX.date, doc.y, { continued: false });
      doc.text('Type', colX.type, doc.y - 11);
      doc.text('Category', colX.category, doc.y - 11);
      doc.text('Amount', colX.amount, doc.y - 11);
      doc.text('Curr.', colX.currency, doc.y - 11);
      doc.text('Note', colX.note, doc.y - 11);
      doc.moveDown(0.5);
      doc.moveTo(36, doc.y).lineTo(559, doc.y).strokeColor('#ccc').stroke();
      doc.moveDown(0.3);

      doc.fillColor('#111').fontSize(9);
      transactions.forEach((t) => {
        const y = doc.y;
        if (y > 780) doc.addPage();
        const rowY = doc.y;
        doc.text(new Date(t.date).toLocaleDateString('en-IN'), colX.date, rowY, { width: 68 });
        doc.text(t.type, colX.type, rowY, { width: 55 });
        doc.text(t.category, colX.category, rowY, { width: 125 });
        doc.text(String(t.amount), colX.amount, rowY, { width: 75 });
        doc.text(t.currency || 'INR', colX.currency, rowY, { width: 45 });
        doc.text(t.note || '', colX.note, rowY, { width: 130 });
        doc.moveDown(0.9);
      });

      doc.end();
      return;
    }

    res.status(400).json({ message: 'Invalid format. Use csv or pdf.' });
  } catch (err) {
    res.status(500).json({ message: 'Export failed.', error: err.message });
  }
});

// GET /transactions/:id — single record, for the edit form
router.get('/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findOne({ _id: req.params.id, userId: req.userId });
    if (!transaction) return res.status(404).json({ message: 'Transaction not found.' });
    res.json({ transaction });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch transaction.', error: err.message });
  }
});

function validatePayload(body) {
  const { type, amount, category, date, receiptImage } = body;
  if (!['income', 'expense'].includes(type)) return 'Type must be income or expense.';
  const amountNum = Number(amount);
  if (Number.isNaN(amountNum) || amountNum <= 0) return 'Amount must be a positive number.';
  if (!category || !String(category).trim()) return 'Category is required.';
  if (!date || Number.isNaN(new Date(date).getTime())) return 'A valid date is required.';
  // Compressed client-side to well under this before upload; guards against
  // an oversized document rather than a real use case.
  if (receiptImage && receiptImage.length > 4_000_000) return 'Receipt image is too large.';
  return null;
}

// POST /transactions — create (REQ-2.1, REQ-2.2)
router.post('/', async (req, res) => {
  try {
    const error = validatePayload(req.body);
    if (error) return res.status(400).json({ message: error });

    const { type, amount, category, date, note, currency, receiptImage } = req.body;
    const transaction = await Transaction.create({
      userId: req.userId,
      type,
      amount: Number(amount),
      category: String(category).trim(),
      date,
      note: note ? String(note).trim() : '',
      currency: currency || 'INR',
      receiptImage: receiptImage || '',
    });
    res.status(201).json({ message: 'Transaction added.', transaction });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create transaction.', error: err.message });
  }
});

// PUT /transactions/:id — edit (REQ-2.3)
router.put('/:id', async (req, res) => {
  try {
    const error = validatePayload(req.body);
    if (error) return res.status(400).json({ message: error });

    const { type, amount, category, date, note, currency, receiptImage } = req.body;
    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      {
        type,
        amount: Number(amount),
        category: String(category).trim(),
        date,
        note: note ? String(note).trim() : '',
        currency: currency || 'INR',
        receiptImage: receiptImage || '',
      },
      { new: true, runValidators: true }
    );
    if (!transaction) return res.status(404).json({ message: 'Transaction not found.' });
    res.json({ message: 'Transaction updated.', transaction });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update transaction.', error: err.message });
  }
});

// DELETE /transactions/:id — remove (REQ-2.4)
router.delete('/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!transaction) return res.status(404).json({ message: 'Transaction not found.' });
    res.json({ message: 'Transaction deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete transaction.', error: err.message });
  }
});

module.exports = router;
