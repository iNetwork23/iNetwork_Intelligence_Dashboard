'use client';
import type {ComponentProps} from 'react';
import {useHydratedLocale} from './LanguageProvider';
import {localizeClientRoot} from './LocalizedLinkContent';

/** Own streamed server content in React, including the first delayed hydration render. */
export default function LocalizedMain({children,...props}:ComponentProps<'main'>){
 const locale=useHydratedLocale();
 return localizeClientRoot(<main {...props}>{children}</main>,locale);
}
