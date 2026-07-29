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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
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

  const fieldMain = props.trafficMode === "api" ? "ADV1" : "Source";
  const fieldSub = props.trafficMode === "api" ? "ADV2" : "Sub1";
  const source = props.mainValue || "nicht übermittelt";
  const sub = props.subValue || "nicht übermittelt";
  const isSubSource = props.level === "sub_source";
  const triggerLabel = active
    ? isSubSource
      ? "Unterquelle wieder aktivieren"
      : "Quelle wieder aktivieren"
    : isSubSource
      ? "Unterquelle ausschalten"
      : "Quelle ausschalten";

  const activate = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/source-blocks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "activate", ...props, reason }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Sperre konnte nicht aktiviert werden");
      }
      sharedLoad = null;
      setBlocks((current) => [
        body.block,
        ...current.filter((item) => item.id !== body.block.id),
      ]);
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
              {active ? "Wieder aktivieren" : "Ausschalten"}
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
            <dt>Offer</dt>
            <dd>{props.offerName}</dd>
          </div>
          <div className="sourceBlockScopeWide">
            <dt>Auswahl</dt>
            <dd>
              {fieldMain}: {source}
              {isSubSource ? ` · ${fieldSub}: ${sub}` : ""}
            </dd>
          </div>
        </dl>

        <p className="sourceBlockImpact">
          {active
            ? "Payout und Partner-Postback gelten danach wieder normal."
            : "Ab Bestätigung: Payout 0 und kein Partner-Postback – nur für diese Auswahl und dieses Offer."}
        </p>

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
            className={active ? "sourceReactivate" : "sourceConfirmBlock"}
            onClick={active ? deactivate : activate}
            disabled={busy}
          >
            {busy
              ? "Wird verifiziert …"
              : active
                ? "Aktivieren"
                : "Jetzt ausschalten"}
          </button>
        </footer>
      </div>
    </div>
  ) : null;

  return (
    <span className="sourceBlockControl">
      <button
        type="button"
        className={`sourceBlockIconButton${active ? " blocked" : ""}`}
        onClick={() => setOpen(true)}
        aria-label={triggerLabel}
        title={triggerLabel}
        aria-pressed={Boolean(active)}
      >
        <PowerIcon />
        <span>{active ? "Ausgeschaltet" : "Ausschalten"}</span>
      </button>
      {error && (
        <small className="sourceBlockError" role="alert">
          {error}
        </small>
      )}
      {modal && createPortal(modal, document.body)}
    </span>
  );
}
