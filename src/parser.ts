import { Handle } from 'dojo-core/interfaces';
import * as has from './has';
import Promise from 'dojo-core/Promise';
import WeakMap from 'dojo-core/WeakMap';
import Registry from 'dojo-core/Registry';

export interface ParserObject {
	node: HTMLElement;
	id: string;
	[name: string]: any;
}

export interface ParserObjectConstructor<T extends ParserObject> {
	new (node?: HTMLElement, options?: any): T;
	prototype: T;
}

export interface RegistrationOptions<T extends ParserObject> {
	proto?: T;
	Ctor?: ParserObjectConstructor<T>;
	doc?: Document;
}

export interface RegistrationOptionsMap {
	[tagName: string]: RegistrationOptions<any>;
}

function instantiateParserObject(node: HTMLElement): ParserObject {
	return;
}

export interface ParserOptions {
	root?: HTMLElement|Document;
}

interface ParserResolver {
	(value?: ParserObject[]): void;
}

interface RegistrationHandle<T extends ParserObject> extends Handle {
	Ctor: ParserObjectConstructor<T>;
}

interface ParserObjectConstructorMap {
	[tagName: string]: ParserObjectConstructor<any>;
}

interface RegistrationMapHandle extends Handle {
	Ctors: ParserObjectConstructorMap;
}

const registryDocumentMap = new WeakMap<Document, Registry<ParserObjectConstructor<any>>>();

export function register<T extends ParserObject>(tagName: string, options: RegistrationOptions<T>): RegistrationHandle<T>;
export function register(map: RegistrationOptionsMap): RegistrationMapHandle;
export function register(tagName: string|RegistrationOptionsMap, options?: RegistrationOptions<any>): any {

	const registryHandles: Handle[] = [];

	function doRegistration(tagName: string, options: RegistrationOptions<any>): ParserObjectConstructor<any> {
		tagName = tagName.toLowerCase();
		let Ctor: any;
		if (!options.Ctor && options.proto) {
			const doc: Document = options.doc || document;
			Ctor = function ParserObject(node?: HTMLElement, options?: any): void {
				for (let key in options) {
					this[key] = options[key];
				}
				if (!node && !this.node) {
					this.node = doc.createElement(<string> tagName);
				}
			};
			Ctor.prototype = <ParserObject> options.proto;
		}
		else if (options.Ctor) {
			Ctor = options.Ctor;
		}
		else {
			throw new SyntaxError('Missing either "Ctor" or "proto" in options.');
		}
		let registry = registryDocumentMap.get(options.doc || document);
		if (!registry) {
			registryDocumentMap.set(options.doc || document, (registry = new Registry<ParserObjectConstructor<any>>(null)));
		}
		registryHandles.push(registry.register(function (node: HTMLElement): boolean {
			if (node.tagName.toLowerCase() === tagName) {
				return true;
			}
			const attrIs = node.getAttribute('is');
			if (attrIs && attrIs.toLowerCase() === tagName) {
				return true;
			}
		}, Ctor));
		return Ctor;
	}

	/* Because handles are bimorphic, depending on arguments, using a sledgehammer of any */
	const handle: any = {
		destroy: function () {
			registryHandles.forEach(registryHandle => registryHandle.destroy());
		}
	};

	if (typeof tagName !== 'string') {
		const map = tagName;
		const registrationMap: ParserObjectConstructorMap = {};
		for (let tag in map) {
			registrationMap[tag] = doRegistration(tag, map[tag]);
		}
		handle.Ctors = registrationMap;
	}
	else {
		handle.Ctor = doRegistration(tagName, options);
	}
	return handle;
}

/**
 * Parses a document (or part of a document) for any nodes that have markup that indicate they should be
 * instantiated and resolves with with a promise that contains an array of the instantiated objects
 * @param  {ParserOptions}           options The configuration options for the parser
 * @return {Promise<ParserObject[]>}         A promise which resolves with the instantied objects
 */
export default function parse(options?: ParserOptions): Promise<ParserObject[]> {
	let root = options && options.root || document;
	if ('body' in root) {
		root = (<Document> root).body;
	}
	return new Promise(function (resolve: ParserResolver) {
		const elements: HTMLElement[] = Array.prototype.slice.call(root.getElementsByTagName('*'));
		const results: ParserObject[] = [];
		elements.filter(node => node.nodeType === 1)
			.forEach(node => {
				const parserObject = instantiateParserObject(node);
				if (parserObject) {
					results.push(parserObject);
				}
			});
		resolve(results);
	});
}
