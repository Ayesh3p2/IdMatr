# IDMatr - Multi-Tenant Identity Platform

A production-ready, multi-tenant identity and access management platform built with NestJS, TypeScript, and PostgreSQL.

## 🚀 Features

- **Multi-Tenant Architecture**: Complete tenant isolation with RLS policies
- **Authentication**: JWT-based auth with refresh tokens
- **MFA Support**: TOTP-based multi-factor authentication
- **RBAC**: Role-based access control with granular permissions
- **Invite System**: Secure tenant onboarding with email invites
- **Core Modules**: IAM, IGA, IVIP, ISPM, ITDR
- **Security**: Encrypted secrets, rate limiting, audit logging
- **Docker Ready**: Full containerization with docker-compose

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Docker & Docker Compose (optional)

## 🛠️ Quick Start

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd idmatr

# Start all services
docker-compose up -d

# Run database migrations
docker-compose exec api npm run db:migrate

# Generate Prisma client
docker-compose exec api npm run db:generate
```

### Option 2: Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start PostgreSQL (or use existing instance)
# Update DATABASE_URL in .env

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Start the application
npm run start:dev
```

## 🌐 API Documentation

Once the application is running, visit:
- **API**: http://localhost:3000/api/v1
- **Swagger Docs**: http://localhost:3000/api/v1/docs
- **Health Check**: http://localhost:3000/health

## 📚 API Endpoints

### Authentication
- `POST /auth/login` - Login with email/password
- `POST /auth/refresh` - Refresh access token
- `POST /auth/mfa/setup` - Setup MFA
- `POST /auth/mfa/verify` - Verify MFA code

### Tenant Management
- `POST /tenants` - Create new tenant
- `GET /tenants/:id` - Get tenant details
- `PUT /tenants/:id` - Update tenant

### Users
- `GET /users` - List users (tenant-scoped)
- `POST /users` - Create user
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user

### Invites
- `POST /invites` - Create invite
- `POST /invites/accept` - Accept invite
- `GET /invites` - List invites

### Core Modules
- **IAM**: `/iam/*` - Identity & Access Management
- **IGA**: `/iga/*` - Identity Governance
- **IVIP**: `/ivip/*` - Identity Verification & Provisioning
- **ISPN**: `/ispn/*` - Application Security Posture Management
- **ITDR**: `/itdr/*` - Threat Detection & Response

## 🔐 Security Features

- **Multi-Tenant Isolation**: Row-level security policies
- **MFA Enforcement**: Required for privileged users
- **Rate Limiting**: 100 requests/minute per IP
- **Input Validation**: Class-validator sanitization
- **Encryption**: MFA secrets encrypted at rest
- **Audit Logging**: All actions logged with tenant context

## 🏗️ Architecture

```
src/
├── auth/           # Authentication & MFA
├── users/          # User management
├── tenants/        # Tenant management
├── invites/        # Invite system
├── mfa/            # Multi-factor auth
├── rbac/           # Role-based access control
├── iga/            # Identity governance
├── ivip/           # Identity verification
├── ispn/           # Security posture
├── itdr/           # Threat detection
├── common/         # Shared utilities
└── prisma/         # Database service
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:cov

# Run specific test file
npm test -- auth/auth.service.spec.ts
```

## 📊 Database Schema

The platform uses PostgreSQL with the following key entities:

- **Tenants**: Multi-tenant organization
- **Users**: Tenant-scoped user accounts
- **Invites**: Secure onboarding tokens
- **Events**: Comprehensive audit trail
- **Requests**: Identity management workflows

## 🔧 Configuration

Key environment variables:

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/idmatr"

# JWT
JWT_SECRET="your-secret-key"
JWT_REFRESH_SECRET="your-refresh-secret"

# Encryption
ENCRYPTION_KEY="32-character-encryption-key"

# MFA
MFA_ISSUER="IDMatr"
MFA_WINDOW=1
```

## 🚀 Production Deployment

1. **Environment Setup**
   ```bash
   cp .env.example .env.production
   # Update production values
   ```

2. **Database Migration**
   ```bash
   npm run db:migrate
   ```

3. **Build Application**
   ```bash
   npm run build
   ```

4. **Start with Docker**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

## 📈 Monitoring

- **Health Checks**: `/health` endpoint
- **Metrics**: Prometheus integration (optional)
- **Logs**: Structured JSON logging
- **Error Tracking**: Comprehensive error handling

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make your changes
4. Add tests
5. Submit pull request

## 📄 License

This project is proprietary and licensed under the IDMatr License Agreement.

## 🆘 Support

For support and questions:
- Email: support@idmatr.com
- Documentation: https://docs.idmatr.com
- Issues: Create GitHub issue

---

**IDMatr** - Enterprise-Ready Identity Management Platform
