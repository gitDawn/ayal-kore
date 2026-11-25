// The Simania reader script, loaded by the staff bookmarklet on Simania's inventory page.
import { READER_SCRIPT } from '@/lib/simania-reader';

export function GET() {
  return new Response(READER_SCRIPT, {
    headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' },
  });
}
