import { NextRequest } from 'next/server';

/**
 * Validates the API key from request headers:
 * Checks 'x-api-key' or 'Authorization: Bearer <token>'
 */
export function validateApiKey(req: NextRequest): boolean {
  const masterKey = process.env.API_KEY;

  // If no API_KEY configured in environment, allow development or log warning
  if (!masterKey) {
    console.warn('WARNING: API_KEY is not defined in environment variables.');
    return true;
  }

  const headerKey = req.headers.get('x-api-key');
  if (headerKey && headerKey === masterKey) {
    return true;
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.substring(7).trim();
    if (bearerToken === masterKey) {
      return true;
    }
  }

  return false;
}
