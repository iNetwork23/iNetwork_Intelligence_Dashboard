type WriteError={code?:string;message:string};

/** Retry only a canceled PostgreSQL statement, using smaller idempotent batches. */
export async function boundedUpsert<T>(rows:readonly T[],write:(batch:T[])=>PromiseLike<{error:WriteError|null}>,operation:string){
 let size=500,offset=0;
 while(offset<rows.length){
  const batch=rows.slice(offset,offset+size),{error}=await write(batch);
  if(error){
   const timedOut=error.message.includes('statement timeout')&&(!error.code||error.code==='57014');
   if(timedOut&&batch.length>25){size=Math.max(25,Math.floor(batch.length/5));continue}
   throw new Error(`Supabase ${operation}: ${error.message}`);
  }
  offset+=batch.length;
 }
}
