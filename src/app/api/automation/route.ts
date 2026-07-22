import {NextResponse} from 'next/server';import {currentUser} from '@/lib/session';import journal from '@/data/automation-journal';
export const dynamic='force-dynamic';
export async function GET(){if(!await currentUser())return NextResponse.json({error:'Unauthorized'},{status:401});return NextResponse.json(journal,{headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})}
