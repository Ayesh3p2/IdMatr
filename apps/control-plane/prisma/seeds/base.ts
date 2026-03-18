import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcryptjs';

export const COMPANY_PREFIXES = [
  'Acme', 'Global', 'Tech', 'Digital', 'Cloud', 'Data', 'Secure', 'Cyber',
  'Prime', 'Alpha', 'Omega', 'Nexus', 'Vertex', 'Apex', 'Quantum', 'Nova',
  'Synergy', 'Horizon', 'Elevate', 'Pinnacle', 'Titan', 'Zenith', 'Vanguard'
];

export const COMPANY_SUFFIXES = [
  'Corp', 'Solutions', 'Systems', 'Technologies', 'Labs', 'Dynamics',
  'Industries', 'Group', 'Holdings', 'Enterprises', 'Inc', 'Ltd', 'LLC'
];

export const DEPARTMENTS = [
  'Engineering', 'Product', 'Design', 'Marketing', 'Sales', 'Finance',
  'Human Resources', 'Legal', 'Operations', 'IT Support', 'Security',
  'Customer Success', 'Research', 'Quality Assurance', 'DevOps'
];

export const ROLES = [
  'software_engineer', 'senior_engineer', 'staff_engineer', 'engineering_manager',
  'product_manager', 'designer', 'data_analyst', 'sales_rep', 'account_manager',
  'financial_analyst', 'hr_specialist', 'legal_counsel', 'operations_manager',
  'security_analyst', 'customer_success_manager', 'qa_engineer', 'devops_engineer'
];

export const INTEGRATION_PROVIDERS = [
  'GOOGLE_WORKSPACE',
  'MICROSOFT_365',
  'SLACK',
  'GITHUB',
  'OKTA',
  'AZURE_AD',
  'AWS_IAM',
  'GITHUB_ENTERPRISE'
];

export const COMPLIANCE_FRAMEWORKS = ['SOC2', 'ISO27001', 'PCI-DSS', 'GDPR', 'HIPAA', 'NIST', 'CIS'];

export const LOCATIONS = [
  'Bengaluru, Karnataka, India',
  'Mumbai, Maharashtra, India',
  'Hyderabad, Telangana, India',
  'Chennai, Tamil Nadu, India',
  'Pune, Maharashtra, India',
  'New York, NY, USA',
  'San Francisco, CA, USA',
  'London, UK',
  'Singapore',
  'Sydney, Australia'
];

export const BENGALURU_TEAMS = [
  'Platform Engineering', 'Identity & Access', 'Security Operations',
  'Cloud Infrastructure', 'Product Development', 'Customer Engineering',
  'Data Platform', 'ML/AI'
];

export function generateCompanyName(): string {
  const prefix = faker.helpers.arrayElement(COMPANY_PREFIXES);
  const suffix = faker.helpers.arrayElement(COMPANY_SUFFIXES);
  return `${prefix} ${suffix}`;
}

export function generateCompanySlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
}

export function generateSSNMasked(): string {
  return `XXX-XX-${faker.string.numeric(4)}`;
}

export function generatePhoneIndian(): string {
  return `+91 ${faker.string.numeric(3)} ${faker.string.numeric(7)}`;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const BATCH_SIZE = 500;
