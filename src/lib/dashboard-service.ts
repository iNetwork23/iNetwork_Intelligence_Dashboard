import { createTtlCache,type Period } from './dashboard';
import { loadDashboard } from './everflow';
const cache=createTtlCache<Awaited<ReturnType<typeof loadDashboard>>>(60_000);
export function getDashboard(period:Period){return cache.get(period,()=>loadDashboard(period,process.env.EVERFLOW_API_KEY||''));}
