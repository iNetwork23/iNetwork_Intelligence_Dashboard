import{getDashboard}from'./dashboard-service';import{analyzeAffiliateTraffic}from'./affiliate-optimizer';
export async function getAffiliateOptimizations(){const[today,days7,days30]=await Promise.all([getDashboard('today'),getDashboard('7d'),getDashboard('30d')]);return analyzeAffiliateTraffic(today,days7,days30)}
