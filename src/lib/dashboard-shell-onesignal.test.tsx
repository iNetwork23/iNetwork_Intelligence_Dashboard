import{Children,type ReactElement,type ReactNode}from'react';
import{afterEach,describe,expect,it,vi}from'vitest';

const currentUser=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/session',()=>({currentUser}));
vi.mock('@/lib/rbac',()=>({can:()=>false}));

import DashboardShell from '@/app/components/DashboardShell';
import OneSignalIdentity from '@/app/settings/app/OneSignalIdentity';

type IdentityProps={enabled:boolean;appId:string;externalId:string};
const identityFrom=(element:ReactElement<{children:ReactNode}>)=>Children.toArray(element.props.children)[0] as ReactElement<IdentityProps>;

describe('DashboardShell OneSignal identity boundary',()=>{
 afterEach(()=>{delete process.env.ONESIGNAL_APP_ID;delete process.env.ONESIGNAL_ENABLED;currentUser.mockReset()});
 it('transitions from an authenticated provider binding to teardown when the session expires',async()=>{
  process.env.ONESIGNAL_APP_ID='public-app-id';process.env.ONESIGNAL_ENABLED='true';
  currentUser.mockResolvedValueOnce({id:'user-a',email:'a@example.test',actorId:'user-a',impersonating:false,access:{role:'admin',scopes:{}}}).mockResolvedValueOnce(null);
  const authenticated=await DashboardShell({children:<main>authenticated</main>}) as ReactElement<{children:ReactNode}>;
  const bound=identityFrom(authenticated);
  expect(bound.type).toBe(OneSignalIdentity);expect(bound.props).toMatchObject({enabled:true,appId:'public-app-id',externalId:'user-a'});
  const expired=await DashboardShell({children:<main>login</main>}) as ReactElement<{children:ReactNode}>;
  const teardown=identityFrom(expired);
  expect(teardown.type).toBe(OneSignalIdentity);expect(teardown.props).toMatchObject({enabled:false,appId:'public-app-id',externalId:''});
 });
});
