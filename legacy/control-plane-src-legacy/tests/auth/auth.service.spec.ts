import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwt: JwtService;

  const mockPrisma = {
    tenantUser: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockJwt = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: JwtService,
          useValue: mockJwt,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwt = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    const mockUser = {
      id: 'user-id',
      email: 'test@example.com',
      name: 'Test User',
      role: 'USER',
      tenantId: 'tenant-id',
      status: 'ACTIVE',
      passwordHash: 'hashed-password',
      mfaEnabled: false,
      failedAttempts: 0,
      lockedUntil: null,
    };

    it('should login successfully with valid credentials', async () => {
      const loginInput = {
        email: 'test@example.com',
        password: 'password123',
        tenantId: 'tenant-id',
      };

      mockPrisma.tenantUser.findFirst.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      mockJwt.signAsync.mockResolvedValue('access-token');

      const result = await service.login(loginInput);

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result.user.email).toBe(loginInput.email);
    });

    it('should throw error for invalid credentials', async () => {
      const loginInput = {
        email: 'test@example.com',
        password: 'wrong-password',
        tenantId: 'tenant-id',
      };

      mockPrisma.tenantUser.findFirst.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      await expect(service.login(loginInput)).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for non-existent user', async () => {
      const loginInput = {
        email: 'nonexistent@example.com',
        password: 'password123',
        tenantId: 'tenant-id',
      };

      mockPrisma.tenantUser.findFirst.mockResolvedValue(null);

      await expect(service.login(loginInput)).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for inactive user', async () => {
      const loginInput = {
        email: 'test@example.com',
        password: 'password123',
        tenantId: 'tenant-id',
      };

      const inactiveUser = { ...mockUser, status: 'INACTIVE' };
      mockPrisma.tenantUser.findFirst.mockResolvedValue(inactiveUser);

      await expect(service.login(loginInput)).rejects.toThrow('Account is not active');
    });
  });

  describe('validateUser', () => {
    const mockUser = {
      id: 'user-id',
      email: 'test@example.com',
      name: 'Test User',
      role: 'USER',
      tenantId: 'tenant-id',
      status: 'ACTIVE',
      passwordHash: 'hashed-password',
    };

    it('should validate user with correct credentials', async () => {
      mockPrisma.tenantUser.findFirst.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password123', 'tenant-id');

      expect(result).toBeDefined();
      expect(result.email).toBe('test@example.com');
    });

    it('should return null for invalid credentials', async () => {
      mockPrisma.tenantUser.findFirst.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      const result = await service.validateUser('test@example.com', 'wrong-password', 'tenant-id');

      expect(result).toBeNull();
    });
  });
});
