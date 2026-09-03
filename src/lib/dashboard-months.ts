const MONTHS=[['01','Januar'],['02','Februar'],['03','März'],['04','April'],['05','Mai'],['06','Juni'],['07','Juli'],['08','August'],['09','September'],['10','Oktober'],['11','November'],['12','Dezember']]as const;
const validYear=(value:string)=>/^\d{4}$/.test(value),validMonth=(value:string)=>/^(0[1-9]|1[0-2])$/.test(value),validDay=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value);
export function dashboardMonthRange(year:string,month:string,maxDate:string){
 if(!validYear(year)||!validMonth(month)||!validDay(maxDate))return null;
 const from=`${year}-${month}-01`;if(from>maxDate)return null;
 const last=new Date(Date.UTC(Number(year),Number(month),0)).getUTCDate(),naturalTo=`${year}-${month}-${String(last).padStart(2,'0')}`;
 return{from,to:naturalTo>maxDate?maxDate:naturalTo};
}
export function dashboardMonthOptions(year:string,maxDate:string){return MONTHS.map(([id,label])=>{const range=dashboardMonthRange(year,id,maxDate);return{id,label,range,disabled:range===null}})}
