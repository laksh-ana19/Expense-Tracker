import client from './client';

export const scanReceiptAI = (imageDataUrl) =>
  client.post('/receipts/scan', { imageDataUrl }).then((r) => r.data);
