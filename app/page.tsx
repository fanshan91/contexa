import { getUser } from '@/lib/db/queries';
import { redirect } from 'next/navigation';

export default async function Page() {
  const user = await getUser();
  redirect(user ? '/dashboard' : '/sign-in');
}

