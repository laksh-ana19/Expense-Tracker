import client from './client';

export const getBudgets = (params) =>
  client.get('/budgets', { params }).then((r) => r.data);

export const saveBudget = (data) =>
  client.post('/budgets', data).then((r) => r.data.budget);

export const deleteBudget = (id) =>
  client.delete(`/budgets/${id}`).then((r) => r.data);
