import { getUser } from '@/lib/db/queries';
import { SessionKeepAlive } from './session-keep-alive';
import DashboardHeader from './header-client';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  const headerUser = user
    ? { id: user.id, email: user.email, name: user.name ?? null }
    : null;

  return (
    <section className="flex h-[100dvh] flex-col overflow-hidden">
      <SessionKeepAlive />
      <DashboardHeader user={headerUser} />
      {children}
    </section>
  );
}
