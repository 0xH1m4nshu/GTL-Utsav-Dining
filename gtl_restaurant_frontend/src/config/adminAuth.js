export const ADMIN_CREDENTIALS = {
  user_id: 'admin',
  password: 'admin123',
};

export const isAdminCredentials = (userId, password) => {
  if (!userId || !password) return false;
  return (
    userId.trim() === ADMIN_CREDENTIALS.user_id &&
    password === ADMIN_CREDENTIALS.password
  );
};
