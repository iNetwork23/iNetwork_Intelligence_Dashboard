"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { berlinDateTime, berlinDay } from "@/lib/format-berlin";
import { createPortal } from "react-dom";
import type {
  SourceBlockLevel,
  SourceBlockRecord,
  SourceTrafficMode,
} from "@/lib/source-blocks";
import {
  SOURCE_BLOCK_REASON_CATEGORIES,
  SOURCE_BLOCK_REASON_LABELS,
  type SourceBlockReasonCategory,
} from "@/lib/source-block-reasons";
import type { SourceBlockHistoryEvent } from "@/lib/source-block-history";
import { sourceBlockHistoryActionLabel } from "@/lib/source-block-history-labels";

/** Kennzahlen, die der Aufrufer vor der Bestätigung zeigt; fehlen sie, entfällt der Block im Dialog. */
export type SourceBlockDialogMetrics = {
  payout: number | null;
  sois: number;
  profit: number | null;
  clicks: number;
  firstSales: number;
  maturity?: string | null;
  leadStatus?: string | null;
};

type Props = {
  affiliateId: string;
  affiliateName: string;
  offerId: string;
  offerName: string;
  campaignId?: string;
  trafficMode: SourceTrafficMode;
  level: SourceBlockLevel;
  mainValue: string | null;
  subValue?: string | null;
  /** Optional: Kennzahlen vor der Bestätigung (Payout, SOIs, Profit, First-Sale-Rate, Klicks, Reife/Lead-Status). */
  metrics?: SourceBlockDialogMetrics;
  /** Geldwerte im Dialog nur mit finance.view (Default: anzeigen). */
  showMoney?: boolean;
  /** Wird nach erfolgreicher Aktivierung oder Deaktivierung mit den geänderten Records aufgerufen (z. B. Zeilenzustand in Listen). */
  onBlocked?: (records: SourceBlockRecord[]) => void;
  /** Dialog direkt beim Einhängen öffnen (Deep-Link aus dem Leitstand: Signal → Sperre in drei Schritten). */
  autoOpen?: boolean;
};

type AffectedOffer = {
  offerId: string;
  offerName: string;
  sois?: number;
  payout?: number;
  profit?: number;
  blocked?: boolean;
};

type HistoryState = {
  status: "idle" | "loading" | "ready" | "error";
  events: SourceBlockHistoryEvent[];
  error: string;
};

let sharedLoad: Promise<SourceBlockRecord[]> | null = null;
let sharedLoadedAt = 0;
const SHARED_TTL_MS = 60_000;

/** Modulweit geteilt, aber höchstens 60 s alt – Sperren anderer Nutzer erscheinen ohne Reload. */
const load = () =>
  (sharedLoad && Date.now() - sharedLoadedAt < SHARED_TTL_MS ? sharedLoad : null) ??
  ((sharedLoadedAt = Date.now()), sharedLoad = fetch("/api/source-blocks", { cache: "no-store" }).then(
    async (response) => {
      const body = await response.json();
      if (!response.ok) {
        throw new Error(
          body.error || "Sperrstatus konnte nicht geladen werden",
        );
      }
      return body.blocks || [];
    },
  ));

const same = (block: SourceBlockRecord, props: Props) =>
  block.affiliateId === Number(props.affiliateId) &&
  block.offerId === Number(props.offerId) &&
  block.trafficMode === props.trafficMode &&
  block.level === props.level &&
  (block.mainValue || null) === (props.mainValue || null) &&
  (block.subValue || null) === (props.subValue || null);

const euro = (value: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
const integer = (value: number) => new Intl.NumberFormat("de-DE").format(value);
const dateTime = (value: string) => berlinDateTime(value);
const day = (value: string) => berlinDay(value);

function PowerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v8" />
      <path d="M7.1 5.7a8 8 0 1 0 9.8 0" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export default function SourceBlockButton(props: Props) {
  const [blocks, setBlocks] = useState<SourceBlockRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [productWide, setProductWide] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [reasonCategory, setReasonCategory] = useState<"" | SourceBlockReasonCategory>("");
  const [confirmation, setConfirmation] = useState("");
  const [requiredConfirmation, setRequiredConfirmation] = useState("");
  const [affectedOffers, setAffectedOffers] = useState<AffectedOffer[]>([]);
  const [history, setHistory] = useState<HistoryState>({ status: "idle", events: [], error: "" });
  const dialogRef = useRef<HTMLDivElement>(null);
  const showMoney = props.showMoney !== false;
  const metrics = props.metrics;

  useEffect(() => {
    let live = true;
    load()
      .then((value) => {
        if (live) setBlocks(value);
      })
      .catch((value) => {
        if (live) {
          setError(
            value instanceof Error
              ? value.message
              : "Sperrstatus konnte nicht geladen werden",
          );
        }
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, busy]);

  const active = useMemo(
    () =>
      blocks.find((block) => same(block, props) && block.status === "active"),
    [blocks, props],
  );

  const uncertain = useMemo(
    () =>
      blocks.find((block) => same(block, props) && block.status === "error"),
    [blocks, props],
  );
  const pending = useMemo(
    () =>
      blocks.find((block) => same(block, props) && block.status === "pending"),
    [blocks, props],
  );
  const recoverable = uncertain?.everflowSettingId ? uncertain : undefined;
  const locked = Boolean(pending || (uncertain && !recoverable));
  const recovering = Boolean(recoverable) && !productWide;
  const existing = active || pending || uncertain;
  const activating = !((active || recovering) && !productWide);
  const lockedHintId = useId();
  const lockedHint = "Manuelle Prüfung laut Runbook nötig";
  const lockedLabel = uncertain ? "Zustand unklar" : "Verifizierung läuft";
  const lockedTitle = uncertain
    ? `${uncertain.error || "Zustand unklar"} · Kein zweiter Aktivierungsversuch ohne manuelle Prüfung in Everflow. ${lockedHint}.`
    : `Verifizierung läuft · Everflow-Bestätigung steht noch aus. ${lockedHint}.`;
  const recoverTitle = `${recoverable?.error || "Zustand unklar"} · Einzige Aktion: Nach Everflow-Prüfung deaktivieren.`;

  const fieldMain = props.trafficMode === "api" ? "ADV1" : "Source";
  const fieldSub = props.trafficMode === "api" ? "ADV2" : "Sub1";
  const source = props.mainValue || "nicht übermittelt";
  const sub = props.subValue || "nicht übermittelt";
  const isSubSource = props.level === "sub_source";
  const controlScope = isSubSource ? fieldSub : fieldMain;
  const triggerLabel = `${isSubSource ? fieldSub : fieldMain} ${isSubSource ? sub : source} ${active ? "wieder aktivieren" : "ausschalten"}`;
  const blockStatusLabel = active
    ? `Gesperrt seit ${day(active.effectiveAt)}`
    : pending
      ? "Verifizierung läuft"
      : uncertain
        ? "Zustand unklar"
        : "Nicht gesperrt";
  const identity = {
    affiliateId: props.affiliateId,
    affiliateName: props.affiliateName,
    offerId: props.offerId,
    offerName: props.offerName,
    campaignId: props.campaignId,
    trafficMode: props.trafficMode,
    level: props.level,
    mainValue: props.mainValue,
    subValue: props.subValue,
  };

  const openDialog = (wide: boolean) => {
    setProductWide(wide);
    setHistory({ status: "idle", events: [], error: "" });
    setOpen(true);
  };

  const autoOpen = props.autoOpen === true;
  useEffect(() => {
    if (autoOpen) openDialog(false);
  }, [autoOpen]);

  const openProductWide = async () => {
    openDialog(true); setConfirmation(""); setAffectedOffers([]); setBusy(true); setError("");
    try {
      const params = new URLSearchParams({action:"preview_across_offers",affiliateId:props.affiliateId,affiliateName:props.affiliateName,offerId:props.offerId,offerName:props.offerName,trafficMode:props.trafficMode,level:props.level,mainValue:props.mainValue||"",subValue:props.subValue||""});
      const response=await fetch(`/api/source-blocks?${params}`,{cache:"no-store"}),body=await response.json();
      if(!response.ok)throw new Error(body.error||"Produktübergreifende Sperre konnte nicht vorbereitet werden");
      setAffectedOffers(body.offers||[]); setRequiredConfirmation(body.requiredConfirmation||"");
    } catch(value) { setError(value instanceof Error?value.message:"Produktübergreifende Sperre konnte nicht vorbereitet werden"); }
    finally { setBusy(false); }
  };

  const loadHistory = async () => {
    if (!existing) return;
    setHistory({ status: "loading", events: [], error: "" });
    try {
      const response = await fetch(`/api/source-blocks?action=history&id=${encodeURIComponent(existing.id)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Historie konnte nicht geladen werden");
      setHistory({ status: "ready", events: body.events || [], error: "" });
    } catch (value) {
      setHistory({ status: "error", events: [], error: value instanceof Error ? value.message : "Historie konnte nicht geladen werden" });
    }
  };

  const activate = async () => {
    if (!reasonCategory) {
      setError("Grundkategorie fehlt");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/source-blocks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: productWide ? "activate_across_offers" : "activate", ...identity, reasonCategory, reason, confirmation }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Sperre konnte nicht aktiviert werden");
      }
      sharedLoad = null;
      const changed:SourceBlockRecord[]=body.blocks||[body.block];
      setBlocks((current) => [...changed,...current.filter((item)=>!changed.some(block=>block.id===item.id))]);
      props.onBlocked?.(changed);
      setOpen(false);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Sperre konnte nicht aktiviert werden",
      );
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async () => {
    const target = active || recoverable;
    if (!target) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/source-blocks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "deactivate", id: target.id }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(
          body.error || "Quelle konnte nicht reaktiviert werden",
        );
      }
      sharedLoad = null;
      setBlocks((current) =>
        current.map((item) =>
          item.id === body.block.id ? body.block : item,
        ),
      );
      props.onBlocked?.([body.block]);
      setOpen(false);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Quelle konnte nicht reaktiviert werden",
      );
    } finally {
      setBusy(false);
    }
  };

  const modal = open ? (
    <div
      className="sourceBlockModal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="source-block-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) setOpen(false);
      }}
    >
      <div
        className="sourceBlockDialog"
        ref={dialogRef}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="sourceBlockDialogHeader">
          <span className={`sourceBlockDialogIcon${active ? " active" : ""}`}>
            <PowerIcon />
          </span>
          <span>
            <small>{isSubSource ? "Unterquelle" : "Hauptquelle"}</small>
            <b id="source-block-title">
              {recovering ? `${controlScope} nach Everflow-Prüfung deaktivieren` : active&&!productWide ? `${controlScope} wieder aktivieren` : productWide ? `${controlScope} überall sperren` : `${controlScope} ausschalten`}
            </b>
          </span>
          <button
            type="button"
            className="sourceBlockClose"
            onClick={() => setOpen(false)}
            disabled={busy}
            aria-label="Dialog schließen"
          >
            <CloseIcon />
          </button>
        </header>

        <dl className="sourceBlockScope">
          <div>
            <dt>Partner</dt>
            <dd>{props.affiliateName}</dd>
          </div>
          <div>
            <dt>{productWide ? "Betroffene Offers" : "Offer"}</dt>
            <dd>
              {productWide
                ? busy
                  ? "Wird serverseitig ermittelt …"
                  : affectedOffers.length
                    ? <ul className="sourceBlockOfferList">{affectedOffers.map(item=><li key={item.offerId}><b>{item.offerName} (#{item.offerId})</b>{typeof item.sois==="number"&&<span>{integer(item.sois)} SOIs{showMoney&&typeof item.payout==="number"?` · Payout ${euro(item.payout)}`:""}{showMoney&&typeof item.profit==="number"?` · Profit ${euro(item.profit)}`:""}</span>}{item.blocked&&<span className="sourceBlockOfferBlocked">bereits gesperrt</span>}</li>)}</ul>
                    : "Nicht verfügbar"
                : props.offerName}
            </dd>
          </div>
          <div className="sourceBlockScopeWide">
            <dt>Auswahl</dt>
            <dd>
              {fieldMain}: {source}
              {isSubSource ? ` · ${fieldSub}: ${sub}` : ""}
            </dd>
          </div>
          {props.campaignId && (
            <div className="sourceBlockScopeWide">
              <dt>Aus der Campaign-Ansicht</dt>
              <dd>Campaign #{props.campaignId}</dd>
            </div>
          )}
        </dl>

        {metrics && (
          <dl className="sourceBlockScope sourceBlockMetrics" aria-label="Kennzahlen vor der Bestätigung">
            {showMoney && metrics.payout !== null && (
              <div><dt>Payout</dt><dd>{euro(metrics.payout)}</dd></div>
            )}
            <div><dt>SOIs</dt><dd>{integer(metrics.sois)}</dd></div>
            {showMoney && metrics.profit !== null && (
              <div><dt>Profit</dt><dd className={metrics.profit < 0 ? "sourceBlockNegative" : ""}>{euro(metrics.profit)}</dd></div>
            )}
            <div><dt>First-Sale-Rate</dt><dd>{metrics.sois > 0 ? `${(metrics.firstSales / metrics.sois * 100).toFixed(1).replace(".", ",")} % (${integer(metrics.firstSales)})` : "–"}</dd></div>
            <div><dt>Klicks</dt><dd>{props.trafficMode === "api" ? "n/a – clickless" : integer(metrics.clicks)}</dd></div>
            <div><dt>Reife · Lead-Status</dt><dd>{[metrics.maturity, metrics.leadStatus].filter(Boolean).join(" · ") || "–"}</dd></div>
            <div className="sourceBlockScopeWide"><dt>Sperrstatus</dt><dd>{blockStatusLabel}</dd></div>
          </dl>
        )}

        <p className="sourceBlockImpact">
          {(active||recovering)&&!productWide
            ? "Vergütung und Partner-Postback gelten danach wieder normal."
            : productWide
              ? "Diese besonders geschützte Aktion setzt Payout und SOI-/Lead-Postback für die Quelle in allen serverseitig gefundenen Offers dieses Affiliates auf aus. Bei einem Teilfehler werden neu angelegte Regeln zurückgerollt."
              : "Ab Bestätigung werden Vergütung und Partner-Postback für diese Auswahl bei diesem Affiliate und Offer gesperrt – campaignübergreifend. Eingehenden Traffic kann nur der Partner selbst stoppen."}
        </p>
        {recovering && (
          <p className="sourceBlockImpact sourceBlockUnclear" role="alert">
            {`Zustand unklar: ${recoverable?.error || "unbekannt"}. Vorher in Everflow prüfen, ob das Setting existiert. Diese Aktion löscht nur ein exakt passendes Setting und setzt den lokalen Datensatz auf inaktiv.`}
          </p>
        )}

        {productWide && (
          <label className="sourceBlockReason sourceBlockConfirmation">
            Zur Bestätigung Quellenwert <b>{requiredConfirmation||"…"}</b> eingeben
            <input value={confirmation} onChange={(event)=>setConfirmation(event.target.value)} autoComplete="off" spellCheck={false}/>
          </label>
        )}

        {activating && (
          <>
            <label className="sourceBlockReason">
              Grundkategorie <span>Pflicht</span>
              <select
                value={reasonCategory}
                onChange={(event) => setReasonCategory(event.target.value as "" | SourceBlockReasonCategory)}
                required
              >
                <option value="">Bitte wählen</option>
                {SOURCE_BLOCK_REASON_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{SOURCE_BLOCK_REASON_LABELS[category]}</option>
                ))}
              </select>
            </label>
            <label className="sourceBlockReason">
              Begründung <span>optional · max. 500 Zeichen</span>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                placeholder="z. B. Partner per Telegram informiert"
              />
            </label>
          </>
        )}

        {existing && (
          <div className="sourceBlockHistory">
            {history.status === "ready" ? (
              history.events.length ? (
                <ol className="sourceBlockHistoryList" aria-label="Historie dieser Sperre">
                  {history.events.map((event) => (
                    <li key={event.id}>
                      <span>{dateTime(event.at)}</span>
                      <b>{sourceBlockHistoryActionLabel(event.action)}</b>
                      <span>{event.reasonCategory ? SOURCE_BLOCK_REASON_LABELS[event.reasonCategory] : "–"}</span>
                      <span>{event.actorId}</span>
                      {event.error && <small>{event.error}</small>}
                    </li>
                  ))}
                </ol>
              ) : (
                <small>Noch keine Historie-Ereignisse.</small>
              )
            ) : (
              <button
                type="button"
                className="sourceBlockHistoryToggle"
                onClick={loadHistory}
                disabled={history.status === "loading"}
              >
                {history.status === "loading" ? "Historie wird geladen …" : "Historie anzeigen"}
              </button>
            )}
            {history.status === "error" && <small className="sourceBlockUnclear" role="alert">{history.error}</small>}
          </div>
        )}

        <footer className="sourceBlockDialogActions">
          <button
            type="button"
            className="sourceBlockCancel"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Abbrechen
          </button>
          <button
            type="button"
            className={(active||recovering)&&!productWide ? "sourceReactivate" : "sourceConfirmBlock"}
            onClick={(active||recovering)&&!productWide ? deactivate : activate}
            disabled={busy || (productWide && confirmation !== requiredConfirmation) || (activating && !reasonCategory)}
          >
            {busy
              ? "Wird verifiziert …"
              : recovering
                ? "Nach Everflow-Prüfung deaktivieren"
                : active&&!productWide
                ? `${controlScope} aktivieren`
                : productWide ? `${controlScope} in allen gefundenen Produkten sperren` : `${controlScope} jetzt ausschalten`}
          </button>
        </footer>
      </div>
    </div>
  ) : null;

  return (
    <span className="sourceBlockControl">
      {locked ? (
        <button
          type="button"
          className="sourceBlockIconButton locked"
          disabled
          aria-disabled="true"
          aria-label={`${controlScope} ${isSubSource ? sub : source}: ${lockedLabel}`}
          aria-describedby={lockedHintId}
          title={lockedTitle}
        >
          <PowerIcon />
          <span>{lockedLabel}</span>
        </button>
      ) : recoverable ? (
        <button
          type="button"
          className="sourceBlockIconButton locked unclear"
          onClick={() => openDialog(false)}
          aria-label={`${controlScope} ${isSubSource ? sub : source}: Zustand unklar · Nach Everflow-Prüfung deaktivieren`}
          title={recoverTitle}
        >
          <PowerIcon />
          <span>Zustand unklar</span>
        </button>
      ) : (
        <button
          type="button"
          className={`sourceBlockIconButton${active ? " blocked" : ""}`}
          onClick={() => openDialog(false)}
          aria-label={triggerLabel}
          title={triggerLabel}
          aria-pressed={Boolean(active)}
        >
          <PowerIcon />
          <span>{active ? `${controlScope} ausgeschaltet` : `${controlScope} ausschalten`}</span>
        </button>
      )}
      {locked && (
        <small id={lockedHintId} className="sourceBlockLockedHint">{lockedHint}</small>
      )}
      {!locked && !recoverable && (
        <button type="button" className="sourceBlockAllProductsButton" onClick={openProductWide}>{controlScope} überall sperren</button>
      )}
      {error && (
        <small className="sourceBlockError" role="alert">
          {error}
        </small>
      )}
      {modal && createPortal(modal, document.body)}
    </span>
  );
}
