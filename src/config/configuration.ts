export interface AppConfig {
  env: string;
  port: number;
  corsOrigins: string[];
  mongoUri: string;
  jwt: {
    accessSecret: string;
    accessTtl: string;
    refreshSecret: string;
    refreshTtl: string;
  };
  seedAdmin?: { email: string; password: string };
  starknet: {
    rpcUrl: string;
    network: string;
    contractAddress: string;
    ownerAddress: string;
    ownerPrivateKey: string;
    enabled: boolean;
    retryIntervalSec: number;
  };
  uploads: { maxBytes: number };
}

/**
 * Typed configuration factory consumed via `ConfigService<AppConfig, true>`.
 * Values are already validated by the Joi schema at bootstrap.
 */
export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  corsOrigins: (process.env.CORS_ORIGINS ?? '*').split(',').map((s) => s.trim()),
  mongoUri: process.env.MONGODB_URI as string,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET as string,
    accessTtl: process.env.JWT_ACCESS_TTL ?? '900s',
    refreshSecret: process.env.JWT_REFRESH_SECRET as string,
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  },
  seedAdmin:
    process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD
      ? { email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD }
      : undefined,
  starknet: {
    rpcUrl: process.env.STARKNET_RPC_URL as string,
    network: process.env.STARKNET_NETWORK ?? 'SN_SEPOLIA',
    contractAddress: process.env.STARKNET_CONTRACT_ADDRESS as string,
    ownerAddress: process.env.STARKNET_OWNER_ADDRESS as string,
    ownerPrivateKey: process.env.STARKNET_OWNER_PRIVATE_KEY as string,
    enabled: (process.env.BLOCKCHAIN_ENABLED ?? 'true') === 'true',
    retryIntervalSec: parseInt(process.env.BLOCKCHAIN_RETRY_INTERVAL_SEC ?? '30', 10),
  },
  uploads: { maxBytes: parseInt(process.env.UPLOAD_MAX_BYTES ?? String(10 * 1024 * 1024), 10) },
});
