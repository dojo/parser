import globalObject from 'dojo-core/global';
import has from 'dojo-core/has';

let jsdom: (html: string) => Document;
if (has('host-node')) {
	jsdom = (<any> require('jsdom')).jsdom;
}

export const shim = jsdom ? jsdom('<html><body></body></html>') : null;

export function patchGlobalConstructor() {
	if (shim) {
		globalObject.Document = (<any> shim.defaultView).Document;
	}
}
