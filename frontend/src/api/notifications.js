import client from './client';

export const getNotifications = () =>
  client.get('/notifications').then((r) => r.data.notifications);
