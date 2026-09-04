/** Einziger Sparkline-Baustein (Home-KPIs, Cockpit): reines Inline-SVG, keine Chart-Bibliothek, keine Animation. */
export type SparklineProps={points:number[];label:string;width?:number;height?:number;tone?:'positive'|'negative'|'neutral';baseline?:boolean};
export default function Sparkline({points,label,width=96,height=24,tone='neutral',baseline=true}:SparklineProps){
 const values=points.filter(value=>Number.isFinite(value));
 if(values.length<2)return <span className="sparkline sparklineEmpty" aria-label={label} title={label}>–</span>;
 const min=Math.min(0,...values),max=Math.max(0,...values),span=max-min||1,innerW=width-2,innerH=height-2;
 const x=(index:number)=>1+(index/(values.length-1))*innerW,y=(value:number)=>1+innerH-((value-min)/span)*innerH;
 const path=values.map((value,index)=>`${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' '),zero=y(0).toFixed(1),last=values[values.length-1];
 return <svg className={`sparkline sparkline-${tone}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}><title>{label}</title>{baseline&&min<0&&max>0?<line className="sparklineZero" x1="1" x2={width-1} y1={zero} y2={zero} stroke="currentColor" strokeOpacity="0.35" strokeWidth="1"/>:null}<polyline points={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/><circle cx={x(values.length-1).toFixed(1)} cy={y(last).toFixed(1)} r="1.8" fill="currentColor"/></svg>;
}
