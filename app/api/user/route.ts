import { getUser } from '@/lib/db/queries';
import { fromUnknownError, jsonOk } from '@/lib/http/response';

export async function GET() {
  try {
    const user = await getUser();
    return jsonOk(user);
  } catch (err) {
    return fromUnknownError(err);
  }
}
