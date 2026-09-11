// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it} from 'vitest';
import {SmartlinkRotationCards} from '../app/components/SmartlinkPresentation';
it('keeps campaign workspace tabs keyboard-operable and uniquely associated when two campaigns render',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const props={slots:[],recommendations:[],rotationLabel:'Reference',windows:{traffic:'Today',economics:'Trend',maturity:'Maturity'}};
 try{
  await act(async()=>root.render(<><SmartlinkRotationCards {...props} campaignId="2"/><SmartlinkRotationCards {...props} campaignId="3"/></>));
  const lists=host.querySelectorAll('[role="tablist"]'),tabs=lists[0].querySelectorAll<HTMLButtonElement>('[role="tab"]');
  const check=(index:number)=>{expect(tabs[index].getAttribute('aria-selected')).toBe('true');expect(tabs[index].tabIndex).toBe(0);expect(tabs[1-index].tabIndex).toBe(-1);const panel=document.getElementById(tabs[index].getAttribute('aria-controls')!)!;expect(panel.hidden).toBe(false);expect(panel.getAttribute('aria-labelledby')).toBe(tabs[index].id);expect(document.activeElement).toBe(tabs[index]);};
  tabs[0].focus();check(0);
  for(const[key,index]of [['ArrowRight',1],['ArrowRight',0],['End',1],['Home',0],['ArrowLeft',1]]as const){await act(async()=>tabs[Number(index===0)].dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true})));check(index)}
  expect(lists[1].querySelector('[aria-selected="true"]')?.textContent).toBe('Landingpages');
  const ids=[...host.querySelectorAll('[id]')].map(el=>el.id);expect(new Set(ids).size).toBe(ids.length);
 }finally{await act(async()=>root.unmount());host.remove()}
});
