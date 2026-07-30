import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/session';
import {canonicalOrigin,checkCsrf,securityHeaders} from '@/lib/security';

export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:securityHeaders});

export async function GET(){
 const user=await currentUser();
 if(!user)return json({error:'Nicht angemeldet'},401);
 return json({enabled:false,supported:false,policy:'password_only'});
}

export async function POST(request:Request){
 const user=await currentUser();
 if(!user)return json({error:'Nicht angemeldet'},401);
 let origin:string;
 try{origin=canonicalOrigin(process.env.APP_ORIGIN,process.env.NODE_ENV,request.url)}catch{return json({error:'Serverkonfiguration ungültig'},500)}
 if(!checkCsrf(request,origin))return json({error:'Anfrage abgelehnt'},403);
 return json({error:'MFA ist für den Dashboard-Login deaktiviert'},410);
}
