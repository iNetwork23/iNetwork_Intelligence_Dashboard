export type SourceBlockReasonCategory='fraud'|'qualitaet'|'partnerwunsch'|'test'|'sonstiges';
export const SOURCE_BLOCK_REASON_LABELS:Record<SourceBlockReasonCategory,string>={fraud:'Fraud-Verdacht',qualitaet:'Schlechte Qualität',partnerwunsch:'Partnerwunsch',test:'Test beendet',sonstiges:'Sonstiges'};
export const SOURCE_BLOCK_REASON_CATEGORIES=Object.keys(SOURCE_BLOCK_REASON_LABELS) as SourceBlockReasonCategory[];
export const isSourceBlockReasonCategory=(value:unknown):value is SourceBlockReasonCategory=>typeof value==='string'&&Object.prototype.hasOwnProperty.call(SOURCE_BLOCK_REASON_LABELS,value);
