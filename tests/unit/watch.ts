import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import { Handle } from 'dojo-core/interfaces';
import watch, { WatcherRecord, ChangeType } from '../../src/watch';
import { shim, patchGlobalConstructor } from '../support/shim-document';

registerSuite(function () {
	let doc = shim || document;

	return {
		name: 'src/watch',
		setup: function () {
			doc.body.innerHTML = '';
		},
		afterEach: function () {
			while (doc.body.lastChild) {
				doc.body.removeChild(doc.body.lastChild);
			}
		},
		'appending': function () {
			const dfd = this.async(250);

			let handle: Handle;
			let div: HTMLDivElement;

			const callback = function (changes: WatcherRecord[]) {
				/* jsdom doesn't create text nodes, but other browsers do, but lets just focus on the nodes we care about */
				changes = changes.filter(value => value.node.nodeType === 1);
				assert.strictEqual(changes.length, 3, 'there should be 3 changes');
				assert.strictEqual(changes[0].type, ChangeType.Added, 'change type should be Added');
				assert.strictEqual(changes[1].type, ChangeType.Added, 'change type should be Added');
				assert.strictEqual(changes[2].type, ChangeType.Added, 'change type should be Added');
				assert.strictEqual(changes[2].node, div);
				handle.destroy();
				dfd.resolve();
			};

			handle = watch(doc.body, callback);
			doc.body.innerHTML = '<div></div><div></div>';
			div = doc.createElement('div');
			doc.body.appendChild(div);
		},
		'removal': function () {
			const dfd = this.async(250);

			let handle: Handle;
			let div: HTMLDivElement;

			const callback = function (changes: WatcherRecord[]) {
				/* jsdom doesn't create text nodes, but other browsers do */
				changes = changes.filter(value => value.node.nodeType === 1);
				assert.strictEqual(changes.length, 3, 'there should be 3 changes');
				assert.strictEqual(changes[0].type, ChangeType.Removed, 'change type should be Removed');
				assert.strictEqual(changes[1].type, ChangeType.Removed, 'change type should be Removed');
				assert.strictEqual(changes[2].type, ChangeType.Removed, 'change type should be Removed');
				assert.strictEqual(changes[2].node, div);
				handle.destroy();
				dfd.resolve();
			};

			doc.body.innerHTML = '<div></div><div></div>';
			div = doc.createElement('div');
			doc.body.appendChild(div);

			handle = watch(doc.body, callback);
			while (doc.body.lastChild) {
				doc.body.removeChild(doc.body.lastChild);
			}
		},
		'append/remove': function () {
			const dfd = this.async(250);

			let handle: Handle;
			let h1: HTMLElement;

			const callback = function(changes: WatcherRecord[]) {
				changes = changes.filter(value => value.node.nodeType === 1);
				assert.strictEqual(changes.length, 2, 'there should be 2 changes');
				assert.strictEqual(changes[0].type, ChangeType.Added, 'change type should be Added');
				assert.strictEqual(changes[1].type, ChangeType.Removed, 'change type should be Removed');
				assert.strictEqual(changes[0].node, h1);
				handle.destroy();
				dfd.resolve();
			};

			doc.body.innerHTML = '<div></div>';
			h1 = doc.createElement('h1');

			handle = watch(doc.body, callback);
			while (doc.body.lastChild) {
				doc.body.removeChild(doc.body.lastChild);
			}
			doc.body.appendChild(h1);
		},
		'appropriate calls to callback': function () {
			const dfd = this.async(500);

			let handle: Handle;
			let called = 0;

			const callback = function(changes: WatcherRecord[]) {
				called++;
			};

			handle = watch(doc.body, callback);
			doc.body.innerHTML = '<div></div>';
			setTimeout(function () {
				doc.body.appendChild(doc.createElement('div'));
			}, 100);
			setTimeout(function () {
				handle.destroy();
				doc.body.appendChild(doc.createElement('div'));
			}, 200);
			setTimeout(function () {
				assert.strictEqual(called, 2, 'callback should be called only 2 times');
				dfd.resolve();
			}, 300);
		},
		'child changes': function () {
			const dfd = this.async(250);

			let handle: Handle;

			const div = doc.createElement('div');
			const span = doc.createElement('span');
			div.id = 'foo';
			div.appendChild(span);
			div.appendChild(doc.createElement('span'));
			span.appendChild(doc.createElement('em'));
			doc.body.appendChild(div);

			const callback = function(changes: WatcherRecord[]) {
				changes = changes.filter(value => value.node.nodeType === 1);
				assert.strictEqual(changes.length, 3, 'there should be 3 changes');
				assert.strictEqual(changes[0].type, ChangeType.Added, 'change type should be Added');
				assert.strictEqual(changes[1].type, ChangeType.Removed, 'change type should be Removed');
				assert.strictEqual(changes[2].type, ChangeType.Removed, 'change type should be Removed');
				assert.strictEqual(changes[1].node, span, 'Node should match');
				handle.destroy();
				dfd.resolve();
			};

			handle = watch(doc.body, callback);
			setTimeout(function () {
				div.innerHTML = '<span><strong>foo</strong></span>';
			}, 100);
		}
	};
});
