import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import { jsdom } from 'src/has!host-node?../support/jsdom';
import parse, { register, ParserObject, RegistrationHandle } from '../../src/parser';

registerSuite(function () {
	let doc: Document;
	let handle: RegistrationHandle<any>;

	class Foo implements ParserObject {
		constructor(node: HTMLElement, options?: any) {
			this.constructOptions = options;
			this.constructNode = node;
		}
		id: string;
		node: HTMLElement;
		constructNode: HTMLElement;
		foo: string = 'foo';
		constructOptions: any;
	}

	class Bar implements ParserObject {
		id: string;
		node: HTMLElement;
		bar: number = 1;
	}

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
		},
		'parsing': {
			'implicit document': function () {
				if (typeof document === 'undefined') {
					this.skip('Environment does not have global document');
				}

				doc.body.innerHTML = `<div>
					<my-foo></my-foo>
				</div>`;

				const handle = register('my-foo', {
					Ctor: Foo
				});

				return parse().then(function (results) {
					assert.strictEqual(results.length, 1, '1 object instantiated');
					assert(results[0].node, 'instance node has a value');
					assert.strictEqual(results[0].node.tagName.toLowerCase(), 'my-foo',
						'The instance has the right tag name');
					assert.instanceOf(results[0], Foo, 'result instance of Foo');
					handle.destroy();
				});
			},
			'no id, no options': function () {
				doc.body.innerHTML = `<div>
					<my-foo></my-foo>
				</div>`;

				const handle = register('my-foo', {
					Ctor: Foo,
					doc: doc
				});

				return parse({ root: doc }).then(function (results) {
					assert.strictEqual(results.length, 1, '1 object instantiated');
					const result = <Foo> results[0];
					assert(result.node, 'instance node has a value');
					assert.strictEqual(result.node.tagName.toLowerCase(), 'my-foo',
						'The instance has the right tag name');
					assert.instanceOf(result, Foo, 'result instance of Foo');
					assert.isUndefined(result.id, 'id should not be defined');
					assert.strictEqual(result.constructNode, result.node,
						'constructor should have been passed node');
					assert.isUndefined(result.constructOptions, 'No options should have been passed');
					handle.destroy();
				});
			},
			'no registration': function () {
				doc.body.innerHTML = `<div>
					<my-foo></my-foo>
				</div>`;

				return parse({ root: doc }).then(function (results) {
					assert.strictEqual(results.length, 0, 'no objects instantiated');
				});
			},
			'id, no options': function () {
				doc.body.innerHTML = `<div>
					<my-foo id="myFoo1"></my-foo>
				</div>`;

				const handle = register('my-foo', {
					Ctor: Foo,
					doc: doc
				});

				return parse({ root: doc }).then(function (results) {
					assert.strictEqual(results.length, 1, '1 object instantiated');
					const result = <Foo> results[0];
					assert.strictEqual(result.id, 'myFoo1');
					assert.strictEqual(result.node.id, result.id, 'the ids match');
					assert.isUndefined(result.constructOptions, 'no options passed');
					handle.destroy();
				});
			},
			'no id, options': function () {
				doc.body.innerHTML = `<div>
					<my-foo data-options='{ "foo": "bar" }'></my-foo>
				</div>`;

				const handle = register('my-foo', {
					Ctor: Foo,
					doc: doc
				});

				return parse({ root: doc }).then(function (results) {
					assert.strictEqual(results.length, 1, '1 object instantiated');
					const result = <Foo> results[0];
					assert.isUndefined(result.id, 'no ID defined');
					assert.deepEqual(result.constructOptions, { foo: 'bar' },
						'construction options match');
					handle.destroy();
				});
			},
			'invalid options': function () {
				const dfd = this.async(250);

				doc.body.innerHTML = `<div>
					<my-foo data-options='{ foo: "bar" }'></my-foo>
				</div>`;

				const handle = register('my-foo', {
					Ctor: Foo,
					doc: doc
				});

				parse({ root: doc }).then(dfd.reject, dfd.callback(function (error: any) {
					assert.instanceOf(error, SyntaxError);
					handle.destroy();
				}));
			},
			'is attribute': function () {
				doc.body.innerHTML = `<div>
					<div is="my-foo"></div>
					<div is="my-bar"></div>
				</div>`;

				const handle = register('my-foo', {
					Ctor: Foo,
					doc: doc
				});

				return parse({ root: doc }).then(function (results) {
					assert.strictEqual(results.length, 1, '1 object instantiated');
					const result = <Foo> results[0];
					assert.isUndefined(result.id, 'no ID defined');
					assert.strictEqual(result.node.tagName.toLowerCase(), 'div',
						'node has proper tag');
					handle.destroy();
				});
			},
			'mutiple': function () {
				doc.body.innerHTML = `
					<my-foo id="myFoo2"></my-foo>
					<div is="my-foo" id="myFoo3"></div>
					<div>
						<my-bar id="myBar1"></my-bar>
						<div is="my-foo" id="myFoo4"></div>
					</div>`;

				const handle = register({
					'my-foo': { Ctor: Foo, doc: doc },
					'my-bar': { Ctor: Bar, doc: doc }
				});

				return parse({ root: doc }).then(function (results) {
					assert.strictEqual(results.length, 4, '4 objects instantiated');
					assert.deepEqual(results.map(item => item.id), [ 'myFoo2', 'myFoo3', 'myBar1', 'myFoo4' ],
						'all the right objects instantiated');
					handle.destroy();
				});
			}
		}
	};
});
