import client from './client';

export const getProfile = () => client.get('/profile').then((r) => r.data.user);
export const updateProfile = (data) => client.put('/profile', data).then((r) => r.data);
export const changePassword = (data) => client.put('/profile/password', data).then((r) => r.data);
