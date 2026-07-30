import{beforeEach,describe,expect,it,vi}from'vitest';
import{parseAccessMetadata}from'./rbac';

const mocks=vi.hoisted(()=>({
 loadAffiliate:vi.fn(),
 loadCampaign:vi.fn(),
 loadDirectory:vi.fn(),
 loadCampaignAffiliates:vi.fn(),
 cacheKeys:[]as string[][],
}));

vi.mock('next/cache',()=>({unstable_cache:(load:()=>unknown,keyParts:string[])=>{mocks.cacheKeys.push(keyParts);return load}}));
vi.mock('./cached-smartlinks',()=>({
 loadAffiliateSmartlinkInsightsFromCache:mocks.loadAffiliate,
 loadCampaignAffiliateRowsFromCache:mocks.loadCampaignAffiliates,
 loadSmartlinkInsightFromCache:mocks.loadCampaign,
}));
vi.mock('./campaign-snapshots',()=>({loadCampaignDirectoryFromCache:mocks.loadDirectory}));

import{getSmartlinkInsight}from'./smartlink-service';

describe('Smartlink source affiliate context',()=>{
 beforeEach(()=>{
  vi.clearAllMocks();
  mocks.cacheKeys.length=0;
  mocks.loadAffiliate.mockResolvedValue([{identity:{campaignId:172,affiliateId:29}}]);
  mocks.loadCampaign.mockResolvedValue({identity:{campaignId:172,affiliateId:0}});
 });

 it('uses the affiliate-scoped loader when an admin deep link carries an affiliate',async()=>{
  const access=parseAccessMetadata({role:'admin'});
  await expect(getSmartlinkInsight(172,access,true,'29')).resolves.toMatchObject({identity:{campaignId:172,affiliateId:29}});
  expect(mocks.loadAffiliate).toHaveBeenCalledWith('29',[172],expect.any(Date));
  expect(mocks.loadCampaign).not.toHaveBeenCalled();
 });

 it('keeps unscoped campaign loading unchanged when no affiliate context exists',async()=>{
  const access=parseAccessMetadata({role:'admin'});
  await getSmartlinkInsight(172,access,true);
  expect(mocks.loadCampaign).toHaveBeenCalledWith(172);
  expect(mocks.loadAffiliate).not.toHaveBeenCalled();
 });

 it('partitions cached Smartlink data by effective affiliate and unscoped access',async()=>{
  const access=parseAccessMetadata({role:'admin'});
  await getSmartlinkInsight(172,access,false,'29');
  await getSmartlinkInsight(172,access,false,'30');
  await getSmartlinkInsight(172,access,false);
  expect(mocks.cacheKeys.map(key=>key.slice(0,3))).toEqual([
   ['smartlink-intelligence-cache-v4','172','29'],
   ['smartlink-intelligence-cache-v4','172','30'],
   ['smartlink-intelligence-cache-v4','172','unscoped'],
  ]);
 });

 it('uses the authorized partner affiliate and rejects invalid or foreign affiliate ids',async()=>{
  const access=parseAccessMetadata({role:'partner',scopes:{affiliate:['29'],campaign:['172']}});
  await getSmartlinkInsight(172,access,true);
  expect(mocks.loadAffiliate).toHaveBeenCalledWith('29',[172],expect.any(Date));
  expect(()=>getSmartlinkInsight(172,access,true,'30')).toThrow(/403/);
  expect(()=>getSmartlinkInsight(172,access,true,'not-an-id')).toThrow(/400/);
 });
});
