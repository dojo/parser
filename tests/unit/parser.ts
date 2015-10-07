import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import { jsdom } from 'src/has!host-node?../support/jsdom';
import parse, { register, ParserObject } from '../../src/parser';

registerSuite(function () {
	let doc: Document;
	return {
		name: 'src/parser',
		setup: function () {
			doc = typeof document === 'undefined' ? jsdom('<html><body></body></html>') : document;
			doc.body.innerHTML = '';
		},
		'registration': {
			'implicit document': function () {
				if (typeof document === 'undefined') {
					this.skip('Environment does not have global document');
				}

				class Foo {
					foo() { console.log('foo'); }
					node: HTMLElement;
					id: string;
				}

				const handle = register('my-foo', {
					Ctor: Foo
				});

				handle.destroy();
			},
			'proto': function () {
				/* The type guarding disallows you passing prototypes that do not
				 * extend the interface of ParserObject */
				const proto = {
					foo: 'foo',
					id: <string> undefined,
					node: <HTMLElement> undefined
				};

				const handle = register('my-foo', {
					proto: proto,
					doc: doc
				});

				const foo = new handle.Ctor();
				assert(foo.node, 'There is something assigned to foo.node');
				assert.strictEqual(foo.node.tagName.toLowerCase(), 'my-foo',
					'Constructor creates a node with the right tagName');
				assert.strictEqual(handle.Ctor.prototype, proto,
					'The passed prototype is the constructors prototype');

				const foo1 = new handle.Ctor(<HTMLElement> null, {
					foo: 'bar'
				});
				assert.strictEqual(foo1.foo, 'bar', 'Options are mixed in properly');
				handle.destroy();
			},
			'ES6 class': function () {
				class Foo implements ParserObject {
					node: HTMLElement = undefined;
					id: string = '';
					foo: string = 'foo';
				}

				const handle = register('my-foo', {
					Ctor: Foo,
					doc: doc
				});

				assert.strictEqual(handle.Ctor, Foo,
					'The passed constructor should equal the handles constructor');
				handle.destroy();
			},
			'Ctor': function () {
				interface FooType extends ParserObject {
					foo: string;
				}

				interface FooConstructor {
					new (object?: any): FooType;
					prototype: FooType;
				}

				function Foo(object?: any) {}

				Foo.prototype = {
					id: undefined,
					node: undefined,
					foo: 'foo'
				};

				const handle = register('my-foo', {
					/* can't figure out how to generate constructor functions typed properly, so using any hammer */
					Ctor: <FooConstructor> <any> Foo,
					doc: doc
				});
				assert.strictEqual(handle.Ctor, Foo,
					'The passed constructor should equal the handles constructor');
				handle.destroy();
			},
			'map': function () {
				class Foo implements ParserObject {
					id: string;
					node: HTMLElement;
					foo: string = 'foo';
				}

				class Bar implements ParserObject {
					id: string;
					node: HTMLElement;
					bar: number = 1;
				}

				const proto = {
					id: <string> undefined,
					node: <HTMLElement> undefined,
					baz: true
				};

				const handle = register({
					'my-foo': { Ctor: Foo, doc: doc },
					'my-bar': { Ctor: Bar, doc: doc },
					'my-baz': { proto: proto, doc: doc }
				});
				assert.strictEqual(handle.Ctors['my-foo'], Foo, 'Constructor should match');
				assert.strictEqual(handle.Ctors['my-bar'], Bar, 'Constructor should match');
				assert.strictEqual(handle.Ctors['my-baz'].prototype, proto, 'Prototype should match');
				handle.destroy();
			},
			'throws': function () {
				assert.throws(function () {
					register('my-foo', {
						doc: doc
					});
				}, SyntaxError, 'Missing either "Ctor" or "proto" in options.');
			}
		}
	};
});
