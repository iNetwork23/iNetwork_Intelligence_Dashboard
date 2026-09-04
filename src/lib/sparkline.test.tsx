import{describe,expect,it}from'vitest';
import{renderToStaticMarkup}from'react-dom/server';
import Sparkline from'../app/components/Sparkline';
describe('Sparkline',()=>{
 it('renders an inline svg polyline with an accessible label and no animation',()=>{const html=renderToStaticMarkup(<Sparkline points={[1,3,2,5]} label="SOIs je Tag"/>);expect(html).toContain('<svg');expect(html).toContain('role="img"');expect(html).toContain('aria-label="SOIs je Tag"');expect(html).toContain('<polyline');expect(html).not.toContain('animate');expect(html).toContain('sparkline-neutral')});
 it('draws a zero line only when values cross zero',()=>{expect(renderToStaticMarkup(<Sparkline points={[-2,1,3]} label="Profit"/>)).toContain('sparklineZero');expect(renderToStaticMarkup(<Sparkline points={[2,1,3]} label="Profit"/>)).not.toContain('sparklineZero')});
 it('falls back to a dash below two finite points',()=>{expect(renderToStaticMarkup(<Sparkline points={[4]} label="x"/>)).toContain('sparklineEmpty');expect(renderToStaticMarkup(<Sparkline points={[Number.NaN,2]} label="x"/>)).toContain('sparklineEmpty')});
});
