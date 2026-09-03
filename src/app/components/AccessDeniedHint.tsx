import InstantLink from '../affiliates/InstantLink';

export default function AccessDeniedHint({permission}:{permission?:string}){
 return <>{permission&&<p>Fehlende Berechtigung: {permission}</p>}<InstantLink href="/">← Zurück zum Account Monitor</InstantLink></>;
}
