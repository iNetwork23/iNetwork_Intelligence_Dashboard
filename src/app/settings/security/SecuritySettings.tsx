export default function SecuritySettings(){
 return <section className="securityCard">
  <div className="securityState">
   <span>ANMELDESICHERHEIT</span>
   <strong>Passwort-Login aktiv</strong>
   <p>Für dieses Dashboard ist kein Authenticator-Code vorgesehen. MFA kann hier nicht aktiviert werden.</p>
  </div>
  <p>Konten, Rollen und Sitzungen werden weiterhin serverseitig geprüft; sicherheitskritische Änderungen werden auditiert.</p>
 </section>
}
