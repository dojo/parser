declare module 'src/has!host-node?../support/jsdom' {
	import * as jsdom from 'jsdom';
	const jd: {
		jsdom(markup: string, config?: jsdom.Config): Document;
	};
	export = jd;
}

declare module 'intern/dojo/node!../../../../../node_modules/jsdom/lib/jsdom' {
	import * as jsdom from 'jsdom';
	const jd: {
		jsdom(markup: string, config?: jsdom.Config): Document;
	};
	export = jd;
}
