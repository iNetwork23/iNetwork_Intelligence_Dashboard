/** Supabase Auth's bcrypt boundary is measured in UTF-8 bytes, not JS characters. */
export const PASSWORD_MAX_BYTES=72;
export function passwordLengthError(password:string,minimum:number):string|null{
  if(password.length<minimum)return `Passwort muss mindestens ${minimum} Zeichen lang sein.`;
  if(new TextEncoder().encode(password).length>PASSWORD_MAX_BYTES)return 'Passwort zu lang. Maximal 72 UTF-8-Bytes; Umlaute und andere Sonderzeichen können mehrere Bytes belegen.';
  return null;
}
