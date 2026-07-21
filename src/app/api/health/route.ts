import { NextResponse } from 'next/server';
import { getDashboard } from '@/lib/dashboard-service';
export async function GET(){try{await getDashboard('7d');return NextResponse.json({ok:true,service:'wlx-performance-monitor',dataSource:'warm'});}catch(error){console.error('Health warmup failed',error);return NextResponse.json({ok:false,service:'wlx-performance-monitor',dataSource:'unavailable'},{status:503});}}
