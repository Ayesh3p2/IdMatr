import { Injectable, Logger } from '@nestjs/common';
import { SecretsManagerClient, GetSecretValueCommand, PutSecretValueCommand, RotateSecretCommand, DescribeSecretCommand } from '@aws-sdk/client-secrets-manager';
import { LoggerService } from '../logging/logger.service';

export interface SecretConfig {
  name: string;
  version?: string;
  versionStage?: 'AWSCURRENT' | 'AWSPENDING';
}

export interface RotationConfig {
  rotationDays: number;
  rotationType: 'AUTOMATIC' | 'MANUAL';
  rotationLambdaArn?: string;
}

@Injectable()
export class SecretsService {
  private readonly secretsManager: SecretsManagerClient;
  private readonly logger: LoggerService;
  private readonly cache: Map<string, { value: string; expires: number }> = new Map();
  private readonly cacheTTL = 300000; // 5 minutes

  constructor(logger: LoggerService) {
    this.logger = logger;
    this.secretsManager = new SecretsManagerClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN,
      },
    });
  }

  async getSecret(secretConfig: SecretConfig): Promise<string> {
    const cacheKey = this.getCacheKey(secretConfig);
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
      return cached.value;
    }

    try {
      const command = new GetSecretValueCommand({
        SecretId: secretConfig.name,
        VersionId: secretConfig.version,
        VersionStage: secretConfig.versionStage || 'AWSCURRENT',
      });

      const response = await this.secretsManager.send(command);
      const secretValue = response.SecretString as string;

      // Cache the secret
      this.cache.set(cacheKey, {
        value: secretValue,
        expires: Date.now() + this.cacheTTL,
      });

      this.logger.log('Secret retrieved successfully', {
        secretName: secretConfig.name,
        version: response.VersionId,
        cacheHit: false,
      });

      return secretValue;
    } catch (error) {
      this.logger.logErrorWithStack('Failed to retrieve secret', error as Error, {
        secretName: secretConfig.name,
        version: secretConfig.version,
      });

      throw new Error(`Failed to retrieve secret: ${secretConfig.name}`);
    }
  }

  async getSecretParsed<T>(secretConfig: SecretConfig): Promise<T> {
    const secretValue = await this.getSecret(secretConfig);
    
    try {
      return JSON.parse(secretValue) as T;
    } catch (error) {
      this.logger.logErrorWithStack('Failed to parse secret as JSON', error as Error, {
        secretName: secretConfig.name,
      });

      throw new Error(`Failed to parse secret as JSON: ${secretConfig.name}`);
    }
  }

  async setSecret(secretName: string, secretValue: string, description?: string): Promise<void> {
    try {
      const command = new PutSecretValueCommand({
        SecretId: secretName,
        SecretString: secretValue,
        Description: description,
      });

      await this.secretsManager.send(command);

      // Invalidate cache
      this.cache.delete(this.getCacheKey({ name: secretName }));

      this.logger.log('Secret stored successfully', {
        secretName,
        description,
      });
    } catch (error) {
      this.logger.logErrorWithStack('Failed to store secret', error as Error, {
        secretName,
      });

      throw new Error(`Failed to store secret: ${secretName}`);
    }
  }

  async setSecretParsed<T>(secretName: string, secretObject: T, description?: string): Promise<void> {
    const secretValue = JSON.stringify(secretObject);
    await this.setSecret(secretName, secretValue, description);
  }

  async rotateSecret(secretName: string, rotationConfig?: RotationConfig): Promise<void> {
    try {
      const command = new RotateSecretCommand({
        SecretId: secretName,
        RotationRules: rotationConfig ? {
          AutomaticallyAfterDays: rotationConfig.rotationDays,
          RotationType: rotationConfig.rotationType,
          RotationLambdaARN: rotationConfig.rotationLambdaArn,
        } : undefined,
      });

      await this.secretsManager.send(command);

      // Invalidate cache
      this.cache.delete(this.getCacheKey({ name: secretName }));

      this.logger.log('Secret rotation initiated', {
        secretName,
        rotationConfig,
      });
    } catch (error) {
      this.logger.logErrorWithStack('Failed to rotate secret', error as Error, {
        secretName,
        rotationConfig,
      });

      throw new Error(`Failed to rotate secret: ${secretName}`);
    }
  }

  async describeSecret(secretName: string): Promise<any> {
    try {
      const command = new DescribeSecretCommand({
        SecretId: secretName,
      });

      const response = await this.secretsManager.send(command);

      return {
        ARN: response.ARN,
        Name: response.Name,
        Description: response.Description,
        CreatedDate: response.CreatedDate,
        LastChangedDate: response.LastChangedDate,
        LastAccessedDate: response.LastAccessedDate,
        RotationEnabled: response.RotationEnabled,
        RotationRules: response.RotationRules,
        VersionsToStages: response.VersionsToStages,
      };
    } catch (error) {
      this.logger.logErrorWithStack('Failed to describe secret', error as Error, {
        secretName,
      });

      throw new Error(`Failed to describe secret: ${secretName}`);
    }
  }

  async getDatabaseCredentials(): Promise<{ username: string; password: string; host: string; port: string; database: string }> {
    return this.getSecretParsed<{ username: string; password: string; host: string; port: string; database: string }>({
      name: process.env.DB_SECRET_NAME || 'idmatr/database-credentials',
    });
  }

  async getJwtSecrets(): Promise<{ accessToken: string; refreshToken: string; encryptionKey: string }> {
    return this.getSecretParsed<{ accessToken: string; refreshToken: string; encryptionKey: string }>({
      name: process.env.JWT_SECRET_NAME || 'idmatr/jwt-secrets',
    });
  }

  async getEmailCredentials(): Promise<{ smtpHost: string; smtpPort: number; smtpUser: string; smtpPass: string }> {
    return this.getSecretParsed<{ smtpHost: string; smtpPort: number; smtpUser: string; smtpPass: string }>({
      name: process.env.EMAIL_SECRET_NAME || 'idmatr/email-credentials',
    });
  }

  async getRedisCredentials(): Promise<{ host: string; port: number; password?: string }> {
    return this.getSecretParsed<{ host: string; port: number; password?: string }>({
      name: process.env.REDIS_SECRET_NAME || 'idmatr/redis-credentials',
    });
  }

  async getEncryptionKey(): Promise<string> {
    const secrets = await this.getJwtSecrets();
    return secrets.encryptionKey;
  }

  async validateSecret(secretName: string): Promise<boolean> {
    try {
      await this.getSecret({ name: secretName });
      return true;
    } catch (error) {
      return false;
    }
  }

  async listSecrets(): Promise<string[]> {
    // Note: AWS Secrets Manager doesn't have a direct list operation without pagination
    // This is a simplified version - implement pagination for production
    const secretNames = [
      process.env.DB_SECRET_NAME || 'idmatr/database-credentials',
      process.env.JWT_SECRET_NAME || 'idmatr/jwt-secrets',
      process.env.EMAIL_SECRET_NAME || 'idmatr/email-credentials',
      process.env.REDIS_SECRET_NAME || 'idmatr/redis-credentials',
    ];

    const validSecrets = [];
    for (const secretName of secretNames) {
      if (await this.validateSecret(secretName)) {
        validSecrets.push(secretName);
      }
    }

    return validSecrets;
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const secrets = await this.listSecrets();
      const secretDetails = [];

      for (const secretName of secrets) {
        try {
          const description = await this.describeSecret(secretName);
          secretDetails.push({
            name: secretName,
            lastChangedDate: description.LastChangedDate,
            rotationEnabled: description.RotationEnabled,
          });
        } catch (error) {
          secretDetails.push({
            name: secretName,
            error: 'Failed to describe secret',
          });
        }
      }

      return {
        status: 'healthy',
        details: {
          totalSecrets: secrets.length,
          secrets: secretDetails,
          cacheSize: this.cache.size,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          cacheSize: this.cache.size,
        },
      };
    }
  }

  private getCacheKey(secretConfig: SecretConfig): string {
    return `${secretConfig.name}:${secretConfig.version || 'latest'}:${secretConfig.versionStage || 'AWSCURRENT'}`;
  }

  clearCache(): void {
    this.cache.clear();
    this.logger.log('Secrets cache cleared');
  }

  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}
