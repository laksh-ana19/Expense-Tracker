import client from './client';

export const getRecurringRules = () =>
  client.get('/recurring').then((r) => r.data);

export const addRecurringRule = (data) =>
  client.post('/recurring', data).then((r) => r.data.rule);

export const updateRecurringRule = (id, data) =>
  client.put(`/recurring/${id}`, data).then((r) => r.data.rule);

export const deleteRecurringRule = (id) =>
  client.delete(`/recurring/${id}`).then((r) => r.data);
