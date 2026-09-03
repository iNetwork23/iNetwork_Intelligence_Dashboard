"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  SourceBlockLevel,
  SourceBlockRecord,
  SourceTrafficMode,
} from "@/lib/source-blocks";

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
};

let sharedLoad: Promise<SourceBlockRecord[]> | null = null;

const load = () =>
  sharedLoad ??
  (sharedLoad = fetch("/api/source-blocks", { cache: "no-store" }).then(
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
  const [confirmation, setConfirmation] = useState("");
  const [requiredConfirmation, setRequiredConfirmation] = useState("");
  const [affectedOffers, setAffectedOffers] = useState<Array<{offerId:string;offerName:string}>>([]);
  const dialogRef = useRef<HTMLDivElement>(null);

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
  const locked = Boolean(uncertain || pending);
  const lockedLabel = uncertain ? "Zustand unklar" : "Verifizierung läuft";
  const lockedTitle = uncertain
    ? `${uncertain.error || "Zustand unklar"} · Kein zweiter Aktivierungsversuch ohne manuelle Prüfung in Everflow.`
    : "Verifizierung läuft · Everflow-Bestätigung steht noch aus.";

  const fieldMain = props.trafficMode === "api" ? "ADV1" : "Source";
  const fieldSub = props.trafficMode === "api" ? "ADV2" : "Sub1";
  const source = props.mainValue || "nicht übermittelt";
  const sub = props.subValue || "nicht übermittelt";
  const isSubSource = props.level === "sub_source";
  const controlScope = isSubSource ? fieldSub : fieldMain;
  const triggerLabel = `${isSubSource ? fieldSub : fieldMain} ${isSubSource ? sub : source} ${active ? "wieder aktivieren" : "ausschalten"}`;

  const openProductWide = async () => {
    setProductWide(true); setConfirmation(""); setAffectedOffers([]); setOpen(true); setBusy(true); setError("");
    try {
      const params = new URLSearchParams({action:"preview_across_offers",affiliateId:props.affiliateId,affiliateName:props.affiliateName,offerId:props.offerId,offerName:props.offerName,trafficMode:props.trafficMode,level:props.level,mainValue:props.mainValue||"",subValue:props.subValue||""});
      const response=await fetch(`/api/source-blocks?${params}`,{cache:"no-store"}),body=await response.json();
      if(!response.ok)throw new Error(body.error||"Produktübergreifende Sperre konnte nicht vorbereitet werden");
      setAffectedOffers(body.offers||[]); setRequiredConfirmation(body.requiredConfirmation||"");
    } catch(value) { setError(value instanceof Error?value.message:"Produktübergreifende Sperre konnte nicht vorbereitet werden"); }
    finally { setBusy(false); }
  };

  const activate = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/source-blocks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: productWide ? "activate_across_offers" : "activate", ...props, reason, confirmation }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Sperre konnte nicht aktiviert werden");
      }
      sharedLoad = null;
      const changed:SourceBlockRecord[]=body.blocks||[body.block];
      setBlocks((current) => [...changed,...current.filter((item)=>!changed.some(block=>block.id===item.id))]);
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
    if (!active) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/source-blocks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "deactivate", id: active.id }),
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
              {active&&!productWide ? `${controlScope} wieder aktivieren` : productWide ? `${controlScope} überall sperren` : `${controlScope} ausschalten`}
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
            <dd>{productWide ? (busy ? "Wird serverseitig ermittelt …" : affectedOffers.map(item=>`${item.offerName} (#${item.offerId})`).join(", ")||"Nicht verfügbar") : props.offerName}</dd>
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

        <p className="sourceBlockImpact">
          {active&&!productWide
            ? "Vergütung und Partner-Postback gelten danach wieder normal."
            : productWide
              ? "Diese besonders geschützte Aktion setzt Payout und SOI-/Lead-Postback für die Quelle in allen serverseitig gefundenen Offers dieses Affiliates auf aus. Bei einem Teilfehler werden neu angelegte Regeln zurückgerollt."
              : "Ab Bestätigung werden Vergütung und Partner-Postback für diese Auswahl bei diesem Affiliate und Offer gesperrt – campaignübergreifend. Eingehenden Traffic kann nur der Partner selbst stoppen."}
        </p>

        {productWide && (
          <label className="sourceBlockReason sourceBlockConfirmation">
            Zur Bestätigung Quellenwert <b>{requiredConfirmation||"…"}</b> eingeben
            <input value={confirmation} onChange={(event)=>setConfirmation(event.target.value)} autoComplete="off" spellCheck={false}/>
          </label>
        )}

        {!active && (
          <label className="sourceBlockReason">
            Notiz <span>optional</span>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="z. B. Partner per Telegram informiert"
            />
          </label>
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
            className={active&&!productWide ? "sourceReactivate" : "sourceConfirmBlock"}
            onClick={active&&!productWide ? deactivate : activate}
            disabled={busy || (productWide && confirmation !== requiredConfirmation)}
          >
            {busy
              ? "Wird verifiziert …"
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
          title={lockedTitle}
        >
          <PowerIcon />
          <span>{lockedLabel}</span>
        </button>
      ) : (
        <button
          type="button"
          className={`sourceBlockIconButton${active ? " blocked" : ""}`}
          onClick={() => {setProductWide(false);setOpen(true)}}
          aria-label={triggerLabel}
          title={triggerLabel}
          aria-pressed={Boolean(active)}
        >
          <PowerIcon />
          <span>{active ? `${controlScope} ausgeschaltet` : `${controlScope} ausschalten`}</span>
        </button>
      )}
      {!locked && (
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
