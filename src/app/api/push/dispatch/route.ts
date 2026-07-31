import{timingSafeEqual}from'node:crypto';
import{NextResponse}from'next/server';
import{dispatchPushOutbox}from'@/lib/push-notifications';
import{securityHeaders}from'@/lib/security';
export const dynamic='force-dynamic';export const maxDuration=300;
function authorized(request:Request){const expected=process.env.CRON_SECRET||'',provided=request.headers.get('authorization')?.replace(/^Bearer\s+/,'')||'';return Boolean(expected&&expected.length===provided.length&&timingSafeEqual(Buffer.from(expected),Buffer.from(provided)))}
const response=(body:unknown,status:number)=>NextResponse.json(body,{status,headers:{...securityHeaders,'Cache-Control':'private, no-store'}});
export async function GET(request:Request){if(!authorized(request))return response({error:'Nicht autorisiert'},401);try{const results=await dispatchPushOutbox(),ok=results.every(row=>row.ok);return response({ok,processed:results.length,sent:results.reduce((sum,row)=>sum+row.sent,0)},ok?200:503)}catch{return response({ok:false,processed:0,sent:0,error:'Push-Dispatch fehlgeschlagen'},503)}}
