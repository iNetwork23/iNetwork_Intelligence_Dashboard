'use client';
import type {ReactElement} from 'react';
import {useHydratedLocale} from './LanguageProvider';
import {localizeClientRoot} from './LocalizedLinkContent';

/** Translate a native client root through React without adding a DOM wrapper. */
export default function LocalizedRoot({children}:{children:ReactElement<Record<string,unknown>>}){
 return localizeClientRoot(children,useHydratedLocale());
}
