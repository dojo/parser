import { Handle } from 'dojo-core/interfaces';
import * as has from './has';
import Promise from 'dojo-core/Promise';
import WeakMap from 'dojo-core/WeakMap';
import Registry from 'dojo-core/Registry';
import { queueMicroTask } from 'dojo-core/queue';
import domWatch, { WatcherRecord, ChangeType } from './watch';

export interface IdMap {
	[id: string]: ParserObject;
}

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

/**
 * A map of registry instances associated with documents
 * @type {WeakMap}
 */
const registryDocumentMap = new WeakMap<Document, Registry<ParserObjectConstructor<any>>>();

/**
 * A map of instances mapped back to their nodes
 * @type {WeakMap}
 */
const nodeMap = new WeakMap<HTMLElement, ParserObject>();

/**
 * A map of document objects to a hash of the object ids and their objects
 */
const idDocumentMap = new WeakMap<Document, IdMap>();

/**
 * Takes a DOM node and inspects it to see if it should instantiate an object based on its tag name as
 * well as parses out any options that should be passed to the constructor.  If the node has already be
 * instantiated, it simply returns the instance.
 * @param  {HTMLElement}  node The DOM node to inspect
 * @return {ParserObject}      The instance associated with the object or undefined if there is no
 *                             match in the registry.
 */
function instantiateParserObject(node: HTMLElement, reject: ParserRejector): ParserObject {
	const registry = registryDocumentMap.get(node.ownerDocument);
	let instance = nodeMap.get(node);

	if (registry && !instance) {
		const Ctor = registry.match(node);
		if (Ctor) {
			let options: any;
			const optionsString = node.getAttribute('data-options');
			if (optionsString) {
				try {
					options = JSON.parse(optionsString);
				}
				catch (err) {
					reject(new SyntaxError('Invalid data-options: ' + err.message + ' in "' + optionsString + '"'));
					return;
				}
			}
			instance = new Ctor(node, options);
			instance.node = node;
			if (node.id) {
				let idMap = idDocumentMap.get(node.ownerDocument);
				if (!idMap) {
					idDocumentMap.set(node.ownerDocument, (idMap = <IdMap> {}));
				}
				instance.id = node.id;
				if (!(instance.id in idMap)) {
					idMap[instance.id] = instance;
				}
				else {
					throw new Error(`An instance has already been registered for ID "${node.id}".`);
				}
			}
			nodeMap.set(node, instance);
		}
	}
	return instance;
}

/**
 * Internal function for dereferencing an instance of a ParserObject
 * @param {ParserObject} instance The instance to be dereferences.
 */
function dereferenceParserObject(instance: ParserObject): void {
	if (instance && instance.node) {
		const idMap = idDocumentMap.get(instance.node.ownerDocument);
		if (idMap && instance.id && instance.id in idMap) {
			delete idMap[instance.id];

			// TODO: Is there a better way to properly remove documents? Since `idDocumentMap` is
			// a WeakMap, is this truly necessary?
			if (!Object.keys(idMap).length) {
				idDocumentMap.delete(instance.node.ownerDocument);
			}
		}

		nodeMap.delete(instance.node);
		instance.node = undefined;
	}
}

/**
 * The public API for retrieving a parser object by node reference
 * @param  {HTMLElement}            node The element to retrieve the parser object for
 * @return {T extends ParserObject}      The instance associated with the node or `undefined`
 */
export function byNode<T extends ParserObject>(node: HTMLElement): T {
	return <T> nodeMap.get(node);
}

/**
 * The public API for retrieving a parser object by ID
 * @param  {string}                 id The ID of the parser object to retrieve
 * @param  {Document}               doc The optional Document. Defaults to `document`.
 * @return {T extends ParserObject}    The instance associated with the ID or `undefiend`
 */
export function byId<T extends ParserObject>(id: string, doc: Document = document): T {
	const idMap = idDocumentMap.get(doc);
	return idMap && <T> idMap[id];
}

/**
 * The public API for removing (dereferencing) an object that was instantiated by the parser
 * @param  {T extends ParserObject} instance The instance to remove from the parser
 */
export function remove<T extends ParserObject>(instance: T): void {
	dereferenceParserObject(instance);
}

interface ParserResolver {
	(value?: ParserObject[]): void;
}

interface ParserRejector {
	(error?: Error): void;
}

export interface RegistrationHandle<T extends ParserObject> extends Handle {
	Ctor: ParserObjectConstructor<T>;
}

interface ParserObjectConstructorMap {
	[tagName: string]: ParserObjectConstructor<any>;
}

interface RegistrationMapHandle extends Handle {
	Ctors: ParserObjectConstructorMap;
}

/**
 * Registers a tag name with the parser for instantiating objects.  The function takes either a tagName with
 * a set of options or a hash of tag names with corresponding options.
 * @param  {string|RegistrationOptionsMap} tagName The name of the tag to register with the parser.
 * @param  {RegistrationOptions<T>}        options A set of options that contain either a prototype or a
 *                                                 constructor function with an optional document.
 * @return {RegistrationHandle}                    A handle to remove the registration and also inclues either
 *                                                 a constructor function (`Ctor`) or a hash of constructor
 *                                                 functions (`Ctors`).
 */
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

const slice = Array.prototype.slice;

export interface WatchChanges {
	added: ParserObject[];
	removed: ParserObject[];
}

export interface WatchOptions {
	root?: HTMLElement|Document;
	callback?: (changes: WatchChanges) => void;
}

let observer: MutationObserver;
let watchHandle: Handle;

/**
 * Watch a node (or document) for nodes being added or removed in the DOM and instantiate or
 * derefence those objects.
 * @param  {WatchOptions} options A set of options for controlling the behaviour of watch
 * @return {Handle}               A handle that allows disconnection of the watcher
 */
export function watch(options?: WatchOptions): Handle {
	const callback = options && options.callback;

	function reject(error: Error) {
		throw error;
	}

	function doCallback(added: ParserObject[], removed: ParserObject[]): void {
		if (callback && (added.length || removed.length)) {
			queueMicroTask(() => {
				callback({
					added: added,
					removed: removed
				});
			});
		}
	}

	function observerCallback(observations: MutationRecord[]): void {
		const added: ParserObject[] = [];
		const removed: ParserObject[] = [];
		observations.forEach(observation => {
			if (observation.type === 'childList') {
				const addedNodes = <HTMLElement[]> slice.call(observation.addedNodes);
				addedNodes.forEach(node => {
					const instance = instantiateParserObject(node, reject);
					if (instance) {
						added.push(instance);
					}
				});
				const removedNodes = <HTMLElement[]> slice.call(observation.removedNodes);
				removedNodes.forEach(node => {
					if (node.nodeType === 1) {
						const instance = nodeMap.get(node);
						if (instance) {
							dereferenceParserObject(nodeMap.get(node));
							removed.push(instance);
						}
					}
				});
			}
			/* else ignore */
		});
		doCallback(added, removed);
	}

	function watchCallback(changes: WatcherRecord[]): void {
		const added: ParserObject[] = [];
		const removed: ParserObject[] = [];
		changes.forEach(change => {
			if (change.type === ChangeType.Added) {
				const instance = instantiateParserObject(change.node, reject);
				if (instance) {
					added.push(instance);
				}
			}
			if (change.type === ChangeType.Removed) {
				const instance = nodeMap.get(change.node);
				if (instance) {
					dereferenceParserObject(instance);
					removed.push(instance);
				}
			}
		});
		doCallback(added, removed);
	}

	let root = options && options.root || document;
	if ('body' in root) {
		root = (<Document> root).body;
	}
	if (observer || watchHandle) {
		throw new Error('Only one active parser watch at any given time.');
	}
	if (has('dom3-mutation-observer')) {
		observer = new MutationObserver(observerCallback);
		observer.observe(root, {
			childList: true,
			subtree: true
		});
	}
	else {
		watchHandle = domWatch(<HTMLElement> root, watchCallback);
	}
	return {
		destroy: function () {
			if (observer) {
				observer.disconnect();
				observer = undefined;
			}
			if (watchHandle) {
				watchHandle.destroy();
				watchHandle = undefined;
			}
		}
	};
}

export interface ParseOptions {
	root?: HTMLElement|Document;
}

/**
 * Parses a document (or part of a document) for any nodes that have markup that indicate they should be
 * instantiated and resolves with with a promise that contains an array of the instantiated objects
 * @param  {ParserOptions}           options The configuration options for the parser
 * @return {Promise<ParserObject[]>}         A promise which resolves with the instantied objects
 */
export default function parse(options?: ParseOptions): Promise<ParserObject[]> {
	let root = options && options.root || document;
	if ('body' in root) {
		root = (<Document> root).body;
	}
	return new Promise(function (resolve: ParserResolver, reject: ParserRejector) {
		const elements: HTMLElement[] = Array.prototype.slice.call(root.getElementsByTagName('*'));
		const results: ParserObject[] = [];
		elements.filter(node => node.nodeType === 1)
			.forEach(node => {
				const parserObject = instantiateParserObject(node, reject);
				if (parserObject) {
					results.push(parserObject);
				}
			});
		/* On Microsoft Edge, if a Promise is first rejected and then resolved in the same turn
		 * Edge will treat it as resolved and not call rejected.  Therefore we will resolve async
		 * and that ensure the rejection, if it occurs, will get called */
		queueMicroTask(() => resolve(results));
	});
}

