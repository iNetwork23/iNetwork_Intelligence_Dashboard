import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const refresh=vi.fn();
vi.mock('next/navigation',()=>({useRouter:()=>({refresh,push:vi.fn()})}));
import CampaignStatusButton from '@/app/affiliates/CampaignStatusButton';

describe('Campaign status control',()=>{
 it('shows a visible scoped pause action, avoids a traffic-off claim and keeps the confirmation in a body portal',()=>{const html=renderToStaticMarkup(<CampaignStatusButton campaignId={135} campaignName="WLX" initialStatus="active" canManage/>),source=readFileSync(join(process.cwd(),'src/app/affiliates/CampaignStatusButton.tsx'),'utf8');expect(html).toContain('Campaign pausieren');expect(html).toContain('aria-pressed="false"');expect(source).toContain('createPortal(modal, document.body)');expect(source).toContain('Status wird auf „paused“');expect(source).toContain('Kein garantierter Traffic-Stopp')});
 it('renders no mutation control without server-derived management permission',()=>{expect(renderToStaticMarkup(<CampaignStatusButton campaignId={135} campaignName="WLX" initialStatus="active" canManage={false}/>)).toBe('')});
 it('fails closed for deleted or unknown campaign states',()=>{expect(renderToStaticMarkup(<CampaignStatusButton campaignId={135} campaignName="WLX" initialStatus="deleted" canManage/>)).toBe('');expect(renderToStaticMarkup(<CampaignStatusButton campaignId={135} campaignName="WLX" initialStatus="mystery" canManage/>)).toBe('')});
 it('refreshes the server-rendered card after a verified status change',()=>{const source=readFileSync(join(process.cwd(),'src/app/affiliates/CampaignStatusButton.tsx'),'utf8');expect(source).toContain("import {useRouter} from 'next/navigation'");expect(source).toContain('router.refresh()');expect(source.indexOf('router.refresh()')).toBeGreaterThan(source.indexOf('setStatus(body.campaign.status)'))});
 it('expires the cached campaign views and patches the active snapshot after a verified status change',()=>{const route=readFileSync(join(process.cwd(),'src/app/api/campaign-status/route.ts'),'utf8'),success=route.indexOf('return after'),invalidate=route.indexOf('revalidateTag',success);expect(route).toContain("import {revalidateTag} from 'next/cache'");expect(invalidate).toBeGreaterThan(success);expect(route).toContain("revalidateTag('campaign-directory',{expire:0})");expect(route).toContain('revalidateTag(`smartlink-${campaignId}`,{expire:0})');expect(route).toContain('revalidateTag(`affiliate-smartlinks-${affiliateId}`,{expire:0})');expect(route).toContain('patchCampaignSnapshotStatus(campaignId,campaign.status)');expect(route.indexOf('patchCampaignSnapshotStatus(campaignId')).toBeGreaterThan(success)});
});
