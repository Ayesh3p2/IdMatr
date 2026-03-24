process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-change-me';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-change-me';
process.env.DATA_ENCRYPTION_KEY = 'test-data-encryption-key-change-me';

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});
