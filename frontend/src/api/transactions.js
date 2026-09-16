import client from './client';

// Returns { transactions, pagination } so callers can drive search/pagination UI.
export const getTransactions = (params) =>
  client.get('/transactions', { params }).then((r) => r.data);

export const getTransaction = (id) =>
  client.get(`/transactions/${id}`).then((r) => r.data.transaction);

export const addTransaction = (data) =>
  client.post('/transactions', data).then((r) => r.data);

export const updateTransaction = (id, data) =>
  client.put(`/transactions/${id}`, data).then((r) => r.data);

export const deleteTransaction = (id) =>
  client.delete(`/transactions/${id}`).then((r) => r.data);

// Downloads a CSV/PDF of the current filter/search as a Blob and triggers a save.
export async function exportTransactions(params, format) {
  const res = await client.get('/transactions/export', {
    params: { ...params, format },
    responseType: 'blob',
  });
  const blob = new Blob([res.data], { type: format === 'pdf' ? 'application/pdf' : 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `transactions.${format === 'pdf' ? 'pdf' : 'csv'}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
