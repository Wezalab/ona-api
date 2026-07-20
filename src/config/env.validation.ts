import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  CORS_ORIGINS: Joi.string().default('*'),

  MONGODB_URI: Joi.string().uri({ scheme: [/mongodb(\+srv)?/] }).required(),

  JWT_ACCESS_SECRET: Joi.string().min(8).required(),
  JWT_ACCESS_TTL: Joi.string().default('900s'),
  JWT_REFRESH_SECRET: Joi.string().min(8).required(),
  JWT_REFRESH_TTL: Joi.string().default('30d'),

  SEED_ADMIN_EMAIL: Joi.string().email().optional(),
  SEED_ADMIN_PASSWORD: Joi.string().min(8).optional(),

  STARKNET_RPC_URL: Joi.string().uri().required(),
  STARKNET_NETWORK: Joi.string().default('SN_SEPOLIA'),
  STARKNET_CONTRACT_ADDRESS: Joi.string().pattern(/^0x[0-9a-fA-F]+$/).required(),
  STARKNET_OWNER_ADDRESS: Joi.string().pattern(/^0x[0-9a-fA-F]+$/).required(),
  STARKNET_OWNER_PRIVATE_KEY: Joi.string().pattern(/^0x[0-9a-fA-F]+$/).required(),
  BLOCKCHAIN_ENABLED: Joi.boolean().default(true),
  BLOCKCHAIN_RETRY_INTERVAL_SEC: Joi.number().default(30),

  UPLOAD_MAX_BYTES: Joi.number().default(10 * 1024 * 1024),
});
