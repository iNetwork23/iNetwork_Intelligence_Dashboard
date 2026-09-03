import {describeDataStatus,getDataStatus,type DataStatus} from '@/lib/data-status';

export default async function DataStatusBar({status}:{status?:DataStatus}){
 const data=status??await getDataStatus(),text=describeDataStatus(data);
 return <div className={`dataStatusBar${data.level==='ok'?'':' warning'}`} role="status" data-level={data.level}><span>{text.primary}</span>{text.ltv&&<span>{text.ltv}</span>}</div>;
}
