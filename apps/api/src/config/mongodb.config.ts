import { registerAs } from '@nestjs/config';

/**
 * Mongo database connection config
 */
export default registerAs('mongodb', () => {
  const { MONGO_PORT, MONGO_DATABASE, MONGO_USERNAME, MONGO_PASSWORD } =
    process.env;

  const MONGO_HOSTNAME = process.env.REPL
    ? process.env.REPL_MONGO_HOSTNAME
    : process.env.MONGO_HOSTNAME;

  return {
    uri:
      process.env.NODE_ENV !== 'production'
        ? `mongodb://${MONGO_HOSTNAME}:${MONGO_PORT}/${MONGO_DATABASE}`
        : `mongodb+srv://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOSTNAME}/${MONGO_DATABASE}?retryWrites=true&w=majority`,
  };
});
