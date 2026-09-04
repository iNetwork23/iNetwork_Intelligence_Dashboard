import { describe, expect, it, vi } from "vitest";
import { validateAutomationDraft } from "./automation-config";
import { buildImportedAutomationDraft } from "./automation-import";
const campaign = {
  network_campaign_id: 146,
  network_affiliate_id: 436,
  campaign_name: "Global",
  campaign_status: "active",
  network_tracking_domain_id: 6450,
  redirect_routing_type: "weight",
  is_open_to_affiliates: false,
  is_use_secure_link: true,
  relationship: {
    redirects: {
      entries: [
        {
          redirect_network_offer_id: 57,
          redirect_network_offer_url_id: 5701,
          routing_value: 50,
        },
        {
          redirect_network_offer_id: 57,
          redirect_network_offer_url_id: 5702,
          routing_value: 25,
        },
        {
          redirect_network_offer_id: 57,
          redirect_network_offer_url_id: 5703,
          routing_value: 25,
        },
      ],
    },
    labels: { entries: [] },
  },
};
describe("legacy campaign import", () => {
  it("imports canonical IDs and weights only as a non-writing draft and places unused active LPs in the candidate queue", async () => {
    const config = await buildImportedAutomationDraft(
      { campaignId: 146, affiliateId: 436, apiKey: "key" },
      {
        readBaseline: vi
          .fn()
          .mockResolvedValue({ campaign, fingerprint: "sha256:x" }),
        searchOffers: vi
          .fn()
          .mockResolvedValue([
            { offerId: 57, name: "Singles69", status: "active" },
          ]),
        loadLandingpages: vi.fn().mockResolvedValue([
          {
            offerId: 57,
            visible: true,
            landingpages: [
              { offerUrlId: 5701, name: "A", status: "active" },
              { offerUrlId: 5702, name: "B", status: "active" },
              { offerUrlId: 5703, name: "C", status: "active" },
              { offerUrlId: 5704, name: "D", status: "active" },
            ],
          },
        ]),
      },
    );
    expect(config.weights).toEqual({mode:"champion_challenger",championOfferUrlId:5701});
    expect(validateAutomationDraft(config)).toEqual([]);
    expect(config.status).toBe("draft");
    expect(config.writeEnabled).toBe(false);
    expect(config.slots.map((x) => x.weight)).toEqual([50, 25, 25]);
    expect(
      config.offers[0].landingpages.find((x) => x.offerUrlId === 5704)
        ?.selection,
    ).toBe("candidate");
  });
  it("fails closed if active redirects are missing from the affiliate-visible inventory", async () => {
    await expect(
      buildImportedAutomationDraft(
        { campaignId: 146, affiliateId: 436, apiKey: "key" },
        {
          readBaseline: vi
            .fn()
            .mockResolvedValue({ campaign, fingerprint: "sha256:x" }),
          searchOffers: vi
            .fn()
            .mockResolvedValue([
              { offerId: 57, name: "Singles69", status: "active" },
            ]),
          loadLandingpages: vi
            .fn()
            .mockResolvedValue([
              { offerId: 57, visible: true, landingpages: [] },
            ]),
        },
      ),
    ).rejects.toThrow("5701");
  });
  it('rejects automatic multi-offer import because LP families require manual confirmation',async()=>{const multi={...campaign,relationship:{...campaign.relationship,redirects:{entries:[campaign.relationship.redirects.entries[0],{...campaign.relationship.redirects.entries[1],redirect_network_offer_id:50,redirect_network_offer_url_id:5001}]}}};const searchOffers=vi.fn(),loadLandingpages=vi.fn();await expect(buildImportedAutomationDraft({campaignId:146,affiliateId:436,apiKey:'test'},{readBaseline:vi.fn().mockResolvedValue({campaign:multi,fingerprint:'sha256:x'}),searchOffers,loadLandingpages})).rejects.toThrow('manuell bestätigte LP-Familien');expect(searchOffers).not.toHaveBeenCalled();expect(loadLandingpages).not.toHaveBeenCalled()});
  it("rejects duplicate active offer URL ids before inventory lookup",async()=>{const duplicate={...campaign,relationship:{...campaign.relationship,redirects:{entries:[campaign.relationship.redirects.entries[0],{...campaign.relationship.redirects.entries[1],redirect_network_offer_url_id:5701},campaign.relationship.redirects.entries[2]]}}};await expect(buildImportedAutomationDraft({campaignId:146,affiliateId:436,apiKey:"test"},{readBaseline:vi.fn().mockResolvedValue({campaign:duplicate,fingerprint:"sha256:x"}),searchOffers:vi.fn(),loadLandingpages:vi.fn()})).rejects.toThrow("doppelte aktive Offer-URL-IDs")});
  it.each([
    ["zero", 0],
    ["negative", -25],
  ])("rejects a %s legacy redirect weight before normalization", async (_label, routingValue) => {
    const invalidCampaign = {
      ...campaign,
      relationship: {
        ...campaign.relationship,
        redirects: {
          entries: campaign.relationship.redirects.entries.map((entry, index) =>
            index === 1 ? { ...entry, routing_value: routingValue } : entry,
          ),
        },
      },
    };
    await expect(
      buildImportedAutomationDraft(
        { campaignId: 146, affiliateId: 436, apiKey: "key" },
        {
          readBaseline: vi.fn().mockResolvedValue({ campaign: invalidCampaign, fingerprint: "sha256:x" }),
          searchOffers: vi.fn().mockResolvedValue([{ offerId: 57, name: "Singles69", status: "active" }]),
          loadLandingpages: vi.fn().mockResolvedValue([{ offerId: 57, visible: true, landingpages: [
            { offerUrlId: 5701, name: "A", status: "active" },
            { offerUrlId: 5702, name: "B", status: "active" },
            { offerUrlId: 5703, name: "C", status: "active" },
          ] }]),
        },
      ),
    ).rejects.toThrow("Campaign-Gewichte sind ungültig.");
  });
  it("takes the maturity window from the deal register (defaults keep 336 h for the former constant)", async () => {
    const deps = () => ({
      readBaseline: vi.fn().mockResolvedValue({ campaign, fingerprint: "sha256:x" }),
      searchOffers: vi.fn().mockResolvedValue([{ offerId: 57, name: "Singles69", status: "active" }]),
      loadLandingpages: vi.fn().mockResolvedValue([{ offerId: 57, visible: true, landingpages: [
        { offerUrlId: 5701, name: "A", status: "active" },
        { offerUrlId: 5702, name: "B", status: "active" },
        { offerUrlId: 5703, name: "C", status: "active" },
      ] }]),
    });
    expect((await buildImportedAutomationDraft({ campaignId: 146, affiliateId: 436, apiKey: "key" }, deps())).thresholds.maturityHours).toBe(336);
    expect((await buildImportedAutomationDraft({ campaignId: 146, affiliateId: 436, apiKey: "key", deals: [] }, deps())).thresholds.maturityHours).toBe(168);
    expect((await buildImportedAutomationDraft({ campaignId: 146, affiliateId: 436, apiKey: "key", deals: [{ affiliateId: 436, campaignId: 146, maturityHours: 400, note: "", updatedAt: "", updatedBy: "t" }] }, deps())).thresholds.maturityHours).toBe(400);
  });
});
