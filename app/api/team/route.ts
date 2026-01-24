import { getTeamForUser } from '@/lib/db/queries';
import { fromUnknownError, jsonOk } from '@/lib/http/response';

export async function GET() {
  try {
    const team = await getTeamForUser();
    return jsonOk(team);
  } catch (err) {
    return fromUnknownError(err);
  }
}
