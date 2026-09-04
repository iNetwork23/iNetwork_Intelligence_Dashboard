type CompanyLike={id:string;name:string};

const normalized=(value:string)=>value.trim().toLocaleLowerCase('de-DE');

export function filterCompanies<T extends CompanyLike>(companies:T[],query:string):T[]{
 const term=normalized(query).replace(/^#/,'');
 if(!term)return companies;
 return companies.filter(company=>normalized(company.name).includes(term)||company.id===term);
}

export function companyResultState(rowCount:number,query:string):'search-empty'|'portfolio-empty'|null{
 if(rowCount>0)return null;
 return normalized(query)?'search-empty':'portfolio-empty';
}
