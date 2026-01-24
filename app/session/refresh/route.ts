import { cookies } from 'next/headers';
import { setSession, verifyToken } from '@/lib/auth/session';
import { jsonOk, unauthorized } from '@/lib/http/response';

export async function POST() {
  try {
    const token = (await cookies()).get('session')?.value;
    if (!token) {
      return unauthorized();
    }

    const session = await verifyToken(token);
    if (!session?.user?.id) {
      return unauthorized();
    }

    const refreshed = await setSession({ id: session.user.id });
    return jsonOk({ expires: refreshed.expires });
  } catch {
    return unauthorized();
  }
}
