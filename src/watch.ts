import { Handle } from 'dojo-core/interfaces';
import { queueMicroTask } from 'dojo-core/queue';
import WeakMap from 'dojo-core/WeakMap';

interface ElementStructure {
	node: HTMLElement;
	kids?: ElementStructure[];
}

/**
 * The dirty polling interval in milliseconds
 * @type {number}
 */
export let checkInterval: number = 30;

export enum ChangeType { Added, Removed }

export interface WatcherRecord {
	node: HTMLElement;
	type: ChangeType;
}

export interface WatcherCallback {
	(changes: WatcherRecord[]): void;
}

let nodeIDCounter = 0;
const nodeIDWeakMap = new WeakMap<HTMLElement, string>();

function getNodeID(node: HTMLElement): string {
	let id = node.id || nodeIDWeakMap.get(node);
	if (!id) {
		nodeIDWeakMap.set(node, id = ('__node_id' + String(++nodeIDCounter)));
	}
	return id;
}

function indexOf(collection: any[]|NodeList, searchFor: any, fromIndex: number, property?: string): number {
	for (; fromIndex < collection.length; fromIndex++) {
		if ((property ? collection[fromIndex][property] : collection[fromIndex]) === searchFor) {
			return fromIndex;
		}
	}
	return -1;
}

interface Conflict {
	i: number;
	j: number;
}

function searchSubTree(changes: WatcherRecord[], target: HTMLElement, oldState: ElementStructure): boolean {
	let dirty = false;

	function resolveConflicts(conflicts: Conflict[], kids: NodeList, oldKids: ElementStructure[]): void {
		let currentNode: HTMLElement;
		let oldStructure: ElementStructure;
		let conflict: Conflict;
		while ((conflict = conflicts.pop())) {
			currentNode = <HTMLElement> kids[conflict.i];
			oldStructure = oldKids[conflict.j];
			findMutations(currentNode, oldStructure);
		}
	}

	function findMutations (node: HTMLElement, state: ElementStructure): void {
		const kids = node.childNodes;
		const klen = kids.length;
		const oldKids = state.kids;
		const olen = oldKids ? oldKids.length : 0;
		const map: { [id: string] : boolean } = {};
		const conflicts: Conflict[] = [];
		let oldStructure: ElementStructure;
		let currentNode: HTMLElement;
		let oldNode: HTMLElement;
		let i = 0;
		let j = 0;
		while (i < klen || j < olen) {
			currentNode = <HTMLElement> kids[i];
			oldStructure = oldKids[j];
			oldNode = oldStructure && oldStructure.node;
			if (currentNode === oldNode) {
				if (conflicts) {
					resolveConflicts(conflicts, kids, oldKids);
				}
				if (currentNode.childNodes.length || oldStructure.kids && oldStructure.kids.length) {
					findMutations(currentNode, oldStructure);
				}
				i++;
				j++;
			}
			else {
				dirty = true;

				let id: string;
				let idx: number;

				if (currentNode) {
					if (!(map[id = getNodeID(currentNode)])) {
						map[id] = true;
						if ((idx = indexOf(oldKids, currentNode, j, 'node')) === -1) {
							changes.push({
								node: currentNode,
								type: ChangeType.Added
							});
						}
						else {
							conflicts.push({
								i: i,
								j: idx
							});
						}
					}
					i++;
				}

				if (oldNode && oldNode !== kids[i]) {
					if (!(map[id = getNodeID(oldNode)])) {
						map[id] = true;
						if ((idx = indexOf(kids, oldNode, i, 'node')) === -1) {
							changes.push({
								node: oldNode,
								type: ChangeType.Removed
							});
						}
						else {
							conflicts.push({
								i: idx,
								j: j
							});
						}
					}
					j++;
				}
			}
			if (conflicts) {
				resolveConflicts(conflicts, kids, oldKids);
			}
		}
	}
	findMutations(target, oldState);
	return dirty;
}

interface ChangeDetector {
	(changes: WatcherRecord[]): void;
}

interface NodeMapElement {
	target: HTMLElement;
	detector: ChangeDetector;
	callback: (changes: WatcherRecord[]) => void;
}

interface IteratorCallback {
	(value: HTMLElement, index?: number, array?: NodeList): ElementStructure;
}

function clone(target: HTMLElement): ElementStructure {
	function map(list: NodeList, iterator: IteratorCallback): ElementStructure[] {
		const results: ElementStructure[] = [];
		for (let i = 0; i < list.length; i++) {
			results[i] = iterator(<HTMLElement> list[i], i, list);
		}
		return results;
	}

	function copy(target: HTMLElement): ElementStructure {
		const elementStructure: ElementStructure = {
			node: target
		};
		if (target.nodeType === 1) {
			elementStructure.kids = map(target.childNodes, copy);
		}
		return elementStructure;
	}
	return copy(target);
}

let nodeMap: NodeMapElement[] = [];

function getChangeDetector(target: HTMLElement): ChangeDetector {
	let oldState: ElementStructure = clone(target);

	return function detectChanges(changes: WatcherRecord[]) {
		let olen: number = changes.length;
		let dirty: boolean = searchSubTree(changes, target, oldState);
		if (dirty || changes.length !== olen) {
			oldState = clone(target);
		}
	};
}

let timer: number|NodeJS.Timer;

function startTimer(): void {
	timer = setTimeout(checkChanges, checkInterval);
}

function checkChanges(): void {
	timer = undefined;
	nodeMap.forEach((item: NodeMapElement) => {
		let changes: WatcherRecord[] = [];
		item.detector(changes);
		if (changes.length) {
			queueMicroTask(function () {
				item.callback(changes);
			});
		}
	});
	if (nodeMap.length) {
		startTimer();
	}
}

export default function watch(node: HTMLElement, callback: WatcherCallback): Handle {
	const item: NodeMapElement = {
		target: node,
		detector: getChangeDetector(node),
		callback: callback
	};
	nodeMap.push(item);
	if (!timer) {
		startTimer();
	}
	return {
		destroy(): void {
			const idx = nodeMap.indexOf(item);
			if (~idx) {
				nodeMap.splice(idx, 1);
			}
		}
	};
};
