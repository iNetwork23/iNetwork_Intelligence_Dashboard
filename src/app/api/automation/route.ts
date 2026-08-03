import {NextResponse} from 'next/server';import {currentUser} from '@/lib/session';import journal from '@/data/automation-journal';import {assessJournalFreshness} from '@/lib/automation-journal';
export const dynamic='force-dynamic';
// Die Frische wird zur Anfragezeit bewertet, nicht zur Buildzeit: das Journal ist ein
// eingecheckter Schnappschuss und altert zwischen zwei Deployments weiter.
export async function GET(){if(!await currentUser())return NextResponse.json({error:'Unauthorized'},{status:401});return NextResponse.json({...journal,freshness:assessJournalFreshness(journal)},{headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})}
