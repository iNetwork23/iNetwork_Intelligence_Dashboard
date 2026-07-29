import React from'react';
import{renderToStaticMarkup}from'react-dom/server';
import{describe,expect,it,vi}from'vitest';
import CopyValue from'../app/affiliates/CopyValue';
import SourcePairCopy from'../app/affiliates/SourcePairCopy';
import{copyText,formatSourcePair,isCopyableSourceValue}from'./clipboard';

describe('source value copy controls',()=>{
 it('copies the exact raw value through the clipboard API',async()=>{const writeText=vi.fn().mockResolvedValue(undefined);await expect(copyText('P-3591625022',{writeText},vi.fn())).resolves.toBe(true);expect(writeText).toHaveBeenCalledWith('P-3591625022')});
 it('uses the fallback when the clipboard API rejects',async()=>{const fallback=vi.fn().mockReturnValue(true);await expect(copyText('sub-42',{writeText:vi.fn().mockRejectedValue(new Error('denied'))},fallback)).resolves.toBe(true);expect(fallback).toHaveBeenCalledWith('sub-42')});
 it('rejects placeholders and empty values',()=>{expect(isCopyableSourceValue('Nicht übermittelt')).toBe(false);expect(isCopyableSourceValue('Ohne Source-ID')).toBe(false);expect(isCopyableSourceValue('N/A')).toBe(false);expect(isCopyableSourceValue('')).toBe(false)});
 it('renders one styled accessible clipboard button with stable success icon markup',()=>{const html=renderToStaticMarkup(<CopyValue label="ADV2" value="P-3591625022"/>);expect(html).toContain('ADV2 P-3591625022 kopieren');expect(html).toContain('class="copyButton idle"');expect(html).toContain('copyIconClipboard');expect(html).toContain('copyIconCheck');expect(html).toContain('aria-live="polite"')});
 it('renders no active button for a missing value',()=>{const html=renderToStaticMarkup(<CopyValue label="ADV1" value="Nicht übermittelt"/>);expect(html).toContain('Nicht übermittelt');expect(html).not.toContain('<button')});
 it('formats tracked and clickless pairs without altering either raw identifier',()=>{expect(formatSourcePair('tracked','255','gse1946lra1')).toBe('Source: 255\nSub1: gse1946lra1');expect(formatSourcePair('api','campaign-a','creative-b')).toBe('ADV1: campaign-a\nADV2: creative-b')});
 it('renders one explicit pair-copy action only when both identifiers exist',()=>{const html=renderToStaticMarkup(<SourcePairCopy mode="tracked" source="255" subSource="gse1946lra1"/>),missing=renderToStaticMarkup(<SourcePairCopy mode="tracked" source="255" subSource="Nicht übermittelt"/>);expect(html).toContain('Source + Sub1 kopieren');expect(html).toContain('Source: 255');expect(html).toContain('Sub1: gse1946lra1');expect(missing).toBe('')});
});
