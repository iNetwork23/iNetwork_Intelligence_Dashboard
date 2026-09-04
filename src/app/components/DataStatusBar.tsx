import {describeDataStatus,getDataStatus,partnerHeaderStatus,type DataStatus} from '@/lib/data-status';

export default async function DataStatusBar({status,audience='internal'}:{status?:DataStatus;audience?:'internal'|'partner'}){
 const data=status??await getDataStatus();
 if(audience==='partner')return <div className="dataStatusBar" role="status" data-audience="partner"><span>{partnerHeaderStatus(data).label}</span></div>;
 const text=describeDataStatus(data);
 return <div className={`dataStatusBar${data.level==='ok'?'':' warning'}`} role="status" data-level={data.level}><span>{text.primary}</span>{text.ltv&&<span>{text.ltv}</span>}</div>;
}
