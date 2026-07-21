import { cookies } from 'next/headers';
import { COOKIE_NAME,verifySession } from './auth';
export async function currentUser(){const secret=process.env.SESSION_SECRET||'';const token=(await cookies()).get(COOKIE_NAME)?.value;return verifySession(token,secret);}
