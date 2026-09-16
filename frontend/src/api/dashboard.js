import client from './client';

export const getSummary = () => client.get('/dashboard/summary').then((r) => r.data);
