import { Role, UserStatus } from '@prisma/client';

export interface RequestUser {
  userId: string;
  email: string;
  name: string;
  role: Role;
  tenantId: string;
  status: UserStatus;
  mfaEnabled: boolean;
}
