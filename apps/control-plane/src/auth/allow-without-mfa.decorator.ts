import { SetMetadata } from '@nestjs/common';

export const ALLOW_WITHOUT_MFA_KEY = 'allowWithoutMfa';
export const AllowWithoutMfa = () => SetMetadata(ALLOW_WITHOUT_MFA_KEY, true);
