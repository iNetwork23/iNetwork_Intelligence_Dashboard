import React from'react';
import{renderToStaticMarkup}from'react-dom/server';
import{describe,expect,it}from'vitest';
import LazyDetails,{buildDisclosureUrl}from'../app/affiliates/LazyDetails';

describe('source disclosure persistence',()=>{
 it('server-renders restored disclosures open with their body mounted',()=>{const html=renderToStaticMarkup(<LazyDetails id="url-0" defaultOpen summary={<span>Default</span>}><div>Source body</div></LazyDetails>);expect(html).toContain('<details id="url-0"');expect(html).toContain('open=""');expect(html).toContain('Source body')});
 it('mirrors open and closed disclosures without losing period, sorting or hash',()=>{const location={pathname:'/affiliates',search:'?sourcePeriod=30d&sourceSort=sois&sourceOpen=url-0',hash:'#url-0'},opened=buildDisclosureUrl(location,'source-25-0-P-3591625022',true),closed=buildDisclosureUrl({...location,search:`?${opened.split('?')[1].split('#')[0]}`},'url-0',false);expect(opened).toContain('sourcePeriod=30d');expect(opened).toContain('sourceSort=sois');expect(opened).toContain('sourceOpen=url-0%2Csource-25-0-P-3591625022');expect(opened.endsWith('#url-0')).toBe(true);expect(closed).not.toContain('url-0%2C');expect(closed).toContain('sourceOpen=source-25-0-P-3591625022')});
});