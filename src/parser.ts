import { Handle } from 'dojo-core/interfaces';
import * as has from './has';
import Promise from 'dojo-core/Promise';
import WeakMap from 'dojo-core/WeakMap';

export interface ParserObject {
	[name: string]: any;
}

export default function parse(options?: any): Promise<ParserObject[]> {
	return;
}
