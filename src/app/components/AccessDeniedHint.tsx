import InstantLink from '../affiliates/InstantLink';
import LocalizedRoot from './LocalizedRoot';

export default function AccessDeniedHint({permission}:{permission?:string}){
 return <>{permission&&<LocalizedRoot><p>Fehlende Berechtigung: {permission}</p></LocalizedRoot>}<InstantLink href="/">← Zurück zum Account Monitor</InstantLink></>;
}
