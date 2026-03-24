# IDMatr Setup Guide

## Quick Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Database Setup
```bash
# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# (Optional) Seed database
npm run db:seed
```

### 4. Start Development Server
```bash
npm run start:dev
```

## Docker Setup

### Using Docker Compose
```bash
# Start all services
docker-compose up -d

# Run migrations
docker-compose exec api npm run db:migrate

# View logs
docker-compose logs -f api
```

## Environment Variables

### Required
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `JWT_REFRESH_SECRET` - Refresh token secret
- `ENCRYPTION_KEY` - 32-character encryption key

### Optional
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `CORS_ORIGIN` - CORS allowed origin

## Database

### PostgreSQL Setup
```sql
CREATE DATABASE idmatr;
CREATE USER idmatr WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE idmatr TO idmatr;
```

### Migration Commands
```bash
# Generate new migration
npx prisma migrate dev --name migration_name

# Reset database
npx prisma migrate reset

# Deploy migrations
npx prisma migrate deploy
```

## API Access

### Health Check
```bash
curl http://localhost:3000/health
```

### API Documentation
Visit: http://localhost:3000/api/v1/docs

## Development

### Code Generation
```bash
# Generate Prisma client
npm run db:generate

# Generate types
npm run build
```

### Testing
```bash
# Run tests
npm test

# Run with coverage
npm run test:cov

# Watch mode
npm run test:watch
```

## Production Deployment

### Build
```bash
npm run build
```

### Start Production
```bash
npm run start:prod
```

### Docker Production
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Check DATABASE_URL in .env
   - Ensure PostgreSQL is running
   - Verify database exists

2. **Prisma Client Error**
   - Run `npm run db:generate`
   - Check schema.prisma file

3. **JWT Token Error**
   - Verify JWT_SECRET is set
   - Check token expiration

4. **MFA Issues**
   - Verify ENCRYPTION_KEY is 32 characters
   - Check system time for TOTP

### Logs
```bash
# Development logs
npm run start:dev

# Production logs
docker-compose logs api

# Database logs
docker-compose logs postgres
```

## Security Notes

- Change default passwords in production
- Use strong JWT secrets
- Enable HTTPS in production
- Regularly update dependencies
- Monitor security advisories

## Support

For issues:
1. Check logs
2. Verify environment configuration
3. Review documentation
4. Create GitHub issue
