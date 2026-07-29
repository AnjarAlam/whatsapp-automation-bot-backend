export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-bot',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'super_secret_jwt_access_key_2026',
    expiresIn: process.env.JWT_EXPIRATION || '1d',
    refreshSecret: process.env.REFRESH_TOKEN_SECRET || 'super_secret_jwt_refresh_key_2026',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRATION || '7d',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    username: process.env.REDIS_USERNAME || 'default',
    password: process.env.REDIS_PASSWORD || '',
  },
});
