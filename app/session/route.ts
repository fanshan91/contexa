import { getSession } from '@/lib/auth/session';
import { jsonOk, unauthorized } from '@/lib/http/response';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return unauthorized();
    }
    return jsonOk({ expires: session.expires });
  } catch {
    return unauthorized();
  }
}
