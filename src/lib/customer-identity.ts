const unavailableCustomerIdentity=/^(?:unjoinable-(?:sha256|legacy-sha256)|api-customer-unavailable-sha256):[0-9a-f]{64}$/;

export const hasStableCustomerIdentity=(value:string|null|undefined)=>{
  const normalized=value?.trim()||'';
  return Boolean(normalized&&!unavailableCustomerIdentity.test(normalized));
};

export const stableCustomerIdentity=(value:string|null|undefined)=>hasStableCustomerIdentity(value)?value!.trim():null;
