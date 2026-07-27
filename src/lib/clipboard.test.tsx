import React from'react';
import{renderToStaticMarkup}from'react-dom/server';
import{describe,expect,it,vi}from'vitest';
import CopyValue from'../app/affiliates/CopyValue';
import{copyText,isCopyableSourceValue}from'./clipboard';

describe('source value copy controls',()=>{
 it('copies the exact raw value through the clipboard API',async()=>{const writeText=vi.fn().mockResolvedValue(undefined);await expect(copyText('P-3591625022',{writeText},vi.fn())).resolves.toBe(true);expect(writeText).toHaveBeenCalledWith('P-3591625022')});
 it('uses the fallback when the clipboard API rejects',async()=>{const fallback=vi.fn().mockReturnValue(true);await expect(copyText('sub-42',{writeText:vi.fn().mockRejectedValue(new Error('denied'))},fallback)).resolves.toBe(true);expect(fallback).toHaveBeenCalledWith('sub-42')});
 it('rejects placeholders and empty values',()=>{expect(isCopyableSourceValue('Nicht übermittelt')).toBe(false);expect(isCopyableSourceValue('Ohne Source-ID')).toBe(false);expect(isCopyableSourceValue('N/A')).toBe(false);expect(isCopyableSourceValue('')).toBe(false)});
 it('renders one styled accessible clipboard button with stable success icon markup',()=>{const html=renderToStaticMarkup(<CopyValue label="ADV2" value="P-3591625022"/>);expect(html).toContain('ADV2 P-3591625022 kopieren');expect(html).toContain('class="copyButton idle"');expect(html).toContain('copyIconClipboard');expect(html).toContain('copyIconCheck');expect(html).toContain('aria-live="polite"')});
 it('renders no active button for a missing value',()=>{const html=renderToStaticMarkup(<CopyValue label="ADV1" value="Nicht übermittelt"/>);expect(html).toContain('Nicht übermittelt');expect(html).not.toContain('<button')});
});
