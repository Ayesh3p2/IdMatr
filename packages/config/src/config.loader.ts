import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { envSchema, EnvConfig } from './env.schema';

export interface AppConfig {
  node: {
    env: string;
    port: number;
    serviceName: string;
  };
  database: {
    url: string;
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  redis: {
    host: string;
    port: number;
    password: string;
    url: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  nats: {
    url: string;
    user: string;
    password: string;
  };
  api: {
    prefix: string;
    allowedOrigins: string[];
  };
  rateLimit: {
    ttl: number;
    max: number;
  };
  log: {
    level: string;
  };
  encryption: {
    dataKey: string;
  };
  neo4j: {
    uri: string;
    username: string;
    password: string;
  };
  smtp: {
    host?: string;
    port: number;
    user?: string;
    password?: string;
    from: string;
  };
  internal: {
    apiSecret: string;
  };
}

const loadYamlConfig = (filePath: string): Record<string, unknown> => {
  if (fs.existsSync(filePath)) {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return yaml.parse(fileContent) || {};
  }
  return {};
};

const getEnvFilePath = (): string => {
  const env = process.env.NODE_ENV || 'development';
  const configDir = process.env.CONFIG_DIR || path.join(process.cwd(), 'config');
  return path.join(configDir, `${env}.yaml`);
};

export const loadConfig = (): AppConfig => {
  const env = process.env.NODE_ENV || 'development';

  const yamlConfig = loadYamlConfig(getEnvFilePath());

  const envVars = {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    SERVICE_NAME: process.env.SERVICE_NAME,
    DATABASE_URL: process.env.DATABASE_URL || yamlConfig.database?.url,
    POSTGRES_HOST: process.env.POSTGRES_HOST || yamlConfig.database?.host,
    POSTGRES_PORT: process.env.POSTGRES_PORT || yamlConfig.database?.port,
    POSTGRES_USER: process.env.POSTGRES_USER || yamlConfig.database?.username,
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || yamlConfig.database?.password,
    POSTGRES_DB: process.env.POSTGRES_DB || yamlConfig.database?.database,
    REDIS_HOST: process.env.REDIS_HOST || yamlConfig.redis?.host,
    REDIS_PORT: process.env.REDIS_PORT || yamlConfig.redis?.port,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD || yamlConfig.redis?.password,
    JWT_SECRET: process.env.JWT_SECRET || yamlConfig.jwt?.secret,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || yamlConfig.jwt?.expiresIn,
    NATS_URL: process.env.NATS_URL || yamlConfig.nats?.url,
    NATS_USER: process.env.NATS_USER || yamlConfig.nats?.username,
    NATS_PASSWORD: process.env.NATS_PASSWORD || yamlConfig.nats?.password,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || yamlConfig.api?.allowedOrigins,
    API_PREFIX: process.env.API_PREFIX || yamlConfig.api?.prefix,
    RATE_LIMIT_TTL: process.env.RATE_LIMIT_TTL || yamlConfig.rateLimit?.ttl,
    RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX || yamlConfig.rateLimit?.max,
    LOG_LEVEL: process.env.LOG_LEVEL || yamlConfig.log?.level,
    DATA_ENCRYPTION_KEY: process.env.DATA_ENCRYPTION_KEY || yamlConfig.encryption?.dataKey,
    NEO4J_URI: process.env.NEO4J_URI || yamlConfig.neo4j?.uri,
    NEO4J_USER: process.env.NEO4J_USER || yamlConfig.neo4j?.username,
    NEO4J_PASSWORD: process.env.NEO4J_PASSWORD || yamlConfig.neo4j?.password,
    SMTP_HOST: process.env.SMTP_HOST || yamlConfig.smtp?.host,
    SMTP_PORT: process.env.SMTP_PORT || yamlConfig.smtp?.port,
    SMTP_USER: process.env.SMTP_USER || yamlConfig.smtp?.user,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD || yamlConfig.smtp?.password,
    SMTP_FROM: process.env.SMTP_FROM || yamlConfig.smtp?.from,
    INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET || yamlConfig.internal?.apiSecret,
  };

  const { error, value } = envSchema.validate(envVars, {
    abortEarly: false,
    allowUnknown: true,
  });

  if (error) {
    throw new Error(`Environment validation failed: ${error.message}`);
  }

  const v = value as Record<string, string>;

  const buildDatabaseUrl = (): string => {
    if (v.DATABASE_URL) return v.DATABASE_URL;
    return `postgresql://${v.POSTGRES_USER}:${v.POSTGRES_PASSWORD}@${v.POSTGRES_HOST}:${v.POSTGRES_PORT}/${v.POSTGRES_DB}`;
  };

  const buildRedisUrl = (): string => {
    if (v.REDIS_PASSWORD) {
      return `redis://:${v.REDIS_PASSWORD}@${v.REDIS_HOST}:${v.REDIS_PORT}`;
    }
    return `redis://${v.REDIS_HOST}:${v.REDIS_PORT}`;
  };

  const parseOrigins = (): string[] => {
    if (!v.ALLOWED_ORIGINS) return [];
    return v.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  };

  return {
    node: {
      env: v.NODE_ENV || 'development',
      port: parseInt(v.PORT || '3000', 10),
      serviceName: v.SERVICE_NAME || 'idmatr',
    },
    database: {
      url: buildDatabaseUrl(),
      host: v.POSTGRES_HOST || 'localhost',
      port: parseInt(v.POSTGRES_PORT || '5432', 10),
      username: v.POSTGRES_USER || 'idmatr',
      password: v.POSTGRES_PASSWORD || '',
      database: v.POSTGRES_DB || 'idmatr_db',
    },
    redis: {
      host: v.REDIS_HOST || 'localhost',
      port: parseInt(v.REDIS_PORT || '6379', 10),
      password: v.REDIS_PASSWORD || '',
      url: buildRedisUrl(),
    },
    jwt: {
      secret: v.JWT_SECRET || 'dev-secret-key-change-in-production',
      expiresIn: v.JWT_EXPIRES_IN || '8h',
    },
    nats: {
      url: v.NATS_URL || 'nats://localhost:4222',
      user: v.NATS_USER || 'idmatr',
      password: v.NATS_PASSWORD || '',
    },
    api: {
      prefix: v.API_PREFIX || 'api',
      allowedOrigins: parseOrigins(),
    },
    rateLimit: {
      ttl: parseInt(v.RATE_LIMIT_TTL || '60', 10),
      max: parseInt(v.RATE_LIMIT_MAX || '100', 10),
    },
    log: {
      level: v.LOG_LEVEL || 'info',
    },
    encryption: {
      dataKey: v.DATA_ENCRYPTION_KEY || '',
    },
    neo4j: {
      uri: v.NEO4J_URI || 'bolt://localhost:7687',
      username: v.NEO4J_USER || 'neo4j',
      password: v.NEO4J_PASSWORD || '',
    },
    smtp: {
      host: v.SMTP_HOST,
      port: parseInt(v.SMTP_PORT || '587', 10),
      user: v.SMTP_USER,
      password: v.SMTP_PASSWORD,
      from: v.SMTP_FROM || 'noreply@idmatr.io',
    },
    internal: {
      apiSecret: v.INTERNAL_API_SECRET || '',
    },
  };
}

export const config = loadConfig();
