import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import CampaignStatusButton from '@/app/affiliates/CampaignStatusButton';

describe('Campaign status control',()=>{
 it('shows a visible scoped pause action, avoids a traffic-off claim and keeps the confirmation in a body portal',()=>{const html=renderToStaticMarkup(<CampaignStatusButton campaignId={135} campaignName="WLX" initialStatus="active" canManage/>),source=readFileSync(join(process.cwd(),'src/app/affiliates/CampaignStatusButton.tsx'),'utf8');expect(html).toContain('Campaign pausieren');expect(html).toContain('aria-pressed="false"');expect(source).toContain('createPortal(modal, document.body)');expect(source).toContain('Status wird auf „paused“');expect(source).toContain('Kein garantierter Traffic-Stopp')});
 it('renders no mutation control without server-derived management permission',()=>{expect(renderToStaticMarkup(<CampaignStatusButton campaignId={135} campaignName="WLX" initialStatus="active" canManage={false}/>)).toBe('')});
 it('fails closed for deleted or unknown campaign states',()=>{expect(renderToStaticMarkup(<CampaignStatusButton campaignId={135} campaignName="WLX" initialStatus="deleted" canManage/>)).toBe('');expect(renderToStaticMarkup(<CampaignStatusButton campaignId={135} campaignName="WLX" initialStatus="mystery" canManage/>)).toBe('')});
});
