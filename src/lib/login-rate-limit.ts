// Best-effort Brute-Force-Bremse für den Dashboard-Login.
// Der Zustand liegt im Prozessspeicher: Bei mehreren Instanzen bremst jede Instanz eigenständig.
export type LoginAttempt={failures:number;windowStart:number;blockedUntil:number};
export type LoginLimiterState=Map<string,LoginAttempt>;
export type LoginLimitDecision={allowed:boolean;retryAfterSeconds:number};

export const LOGIN_WINDOW_SECONDS=900;
export const LOGIN_FAILURE_THRESHOLD=5;
export const LOGIN_BASE_LOCKOUT_SECONDS=60;
export const LOGIN_MAX_LOCKOUT_SECONDS=3600;
export const LOGIN_MAX_TRACKED_KEYS=5_000;

export const createLoginLimiterState=():LoginLimiterState=>new Map();

const lockoutFor=(failures:number)=>Math.min(LOGIN_BASE_LOCKOUT_SECONDS*2**Math.max(0,failures-LOGIN_FAILURE_THRESHOLD),LOGIN_MAX_LOCKOUT_SECONDS);

/** Verwirft Einträge, deren Sperre und Zählfenster abgelaufen sind. */
export function pruneLoginAttempts(state:LoginLimiterState,now:number){
  for(const [key,attempt] of state)if(attempt.blockedUntil<=now&&now-attempt.windowStart>=LOGIN_WINDOW_SECONDS)state.delete(key);
}

/** Liest den Client-Schlüssel aus den Proxy-Headern; ohne verwertbare IP wird global gebremst. */
export function loginClientKey(headers:Headers){
  const forwarded=headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded||headers.get('x-real-ip')?.trim()||'unknown';
}

/** Prüft vor der Passwortprüfung, ob der Client aktuell gesperrt ist. */
export function checkLoginAllowed(state:LoginLimiterState,key:string,now:number):LoginLimitDecision{
  const attempt=state.get(key);
  if(!attempt||attempt.blockedUntil<=now)return{allowed:true,retryAfterSeconds:0};
  return{allowed:false,retryAfterSeconds:Math.ceil(attempt.blockedUntil-now)};
}

/** Zählt einen Fehlversuch und sperrt ab dem Schwellwert mit wachsender Wartezeit. */
export function registerLoginFailure(state:LoginLimiterState,key:string,now:number):LoginLimitDecision{
  if(state.size>=LOGIN_MAX_TRACKED_KEYS)pruneLoginAttempts(state,now);
  const previous=state.get(key);
  const inWindow=previous&&now-previous.windowStart<LOGIN_WINDOW_SECONDS;
  const failures=(inWindow?previous.failures:0)+1;
  const windowStart=inWindow?previous.windowStart:now;
  const blockedUntil=failures>=LOGIN_FAILURE_THRESHOLD?now+lockoutFor(failures):0;
  state.set(key,{failures,windowStart,blockedUntil});
  return blockedUntil?{allowed:false,retryAfterSeconds:Math.ceil(blockedUntil-now)}:{allowed:true,retryAfterSeconds:0};
}

/** Ein erfolgreicher Login räumt den Zähler des Clients ab. */
export function registerLoginSuccess(state:LoginLimiterState,key:string){state.delete(key)}
