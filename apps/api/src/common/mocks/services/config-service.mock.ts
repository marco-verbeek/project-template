export const getMockConfigService = () => {
  return {
    get: jest.fn((key: string) => {
      if (key === 'ACCESS_TOKEN_SECRET') return 'at-secret-for-tests';
      if (key === 'ACCESS_TOKEN_EXPIRATION') return '15d';
      if (key === 'REFRESH_TOKEN_SECRET') return 'rt-secret-for-tests';
      if (key === 'REFRESH_TOKEN_EXPIRATION') return '30d';

      return null;
    }),
  };
};
