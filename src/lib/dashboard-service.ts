import { unstable_cache } from 'next/cache';
import type { Period } from './dashboard';
import { loadPortfolio } from './everflow';
const cached={
 today:unstable_cache(()=>loadPortfolio('today',process.env.EVERFLOW_API_KEY||''),['account-portfolio','today'],{revalidate:60,tags:['account-portfolio']}),
 '7d':unstable_cache(()=>loadPortfolio('7d',process.env.EVERFLOW_API_KEY||''),['account-portfolio','7d'],{revalidate:60,tags:['account-portfolio']}),
 '30d':unstable_cache(()=>loadPortfolio('30d',process.env.EVERFLOW_API_KEY||''),['account-portfolio','30d'],{revalidate:60,tags:['account-portfolio']}),
};
export function getDashboard(period:Period){return cached[period]();}
