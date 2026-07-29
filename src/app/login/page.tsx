import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/session';

export default async function Login({searchParams}:{searchParams:Promise<{error?:string;mfa?:string}>}){
 if(await currentUser())redirect('/');
 const {error,mfa}=await searchParams,needsMfa=mfa==='1';
 return <main className="loginShell">
  <section className="loginCard">
   <div className="eyebrow">ME MEDIA · PERFORMANCE MONITOR</div>
   <h1>Everflow Dashboard</h1>
   <p>{needsMfa?'Anmeldung mit dem Code aus deiner Authenticator-App abschließen.':'Geschützter Zugriff für Mitarbeitende und Partner.'}</p>
   {error&&<div className="loginError">{needsMfa?'Der MFA-Code ist ungültig oder abgelaufen.':'E-Mail, Benutzername oder Passwort ist falsch.'}</div>}
   {needsMfa?<form action="/api/auth/login" method="post">
    <label htmlFor="mfa_code">MFA-Code</label>
    <input id="mfa_code" name="mfa_code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required autoFocus/>
    <button>Anmeldung abschließen</button>
   </form>:<form action="/api/auth/login" method="post">
    <label htmlFor="username">E-Mail oder Benutzername</label>
    <input id="username" name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus/>
    <label htmlFor="password">Passwort</label>
    <input id="password" name="password" type="password" autoComplete="current-password" required/>
    <button>Anmelden</button>
   </form>}
   <div className="security"><span/>HttpOnly-Session · 30 Min. inaktiv · max. 12 Std.</div>
  </section>
  <aside className="loginAside"><div className="offerTag">ROLLENBASIERTER ZUGRIFF</div><h2>Profit statt Datenrauschen.</h2><p>Sichtbarkeit und Partnerdaten werden serverseitig nach individuellen Rechten und Scopes begrenzt.</p><dl><div><dt>Session</dt><dd>Widerrufbar</dd></div><div><dt>Daten</dt><dd>Scope-gefiltert</dd></div><div><dt>Schutz</dt><dd>Deny by default</dd></div></dl></aside>
 </main>;
}
