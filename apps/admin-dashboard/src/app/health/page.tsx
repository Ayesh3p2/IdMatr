// Redirect infrastructure health page to the tenant-safe Platform Status page.
// Internal infrastructure details (Neo4j, Redis, PostgreSQL ports, etc.)
// must never be exposed to tenant users.
import { redirect } from 'next/navigation';

export default function HealthRedirect() {
  redirect('/status');
}
