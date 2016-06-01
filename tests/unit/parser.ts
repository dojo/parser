import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import { Handle } from 'dojo-core/interfaces';
import parse, {
	register,
	ParserObject,
	RegistrationHandle,
	byId,
	byNode,
	remove,
	watch,
	WatchChanges
} from '../../src/parser';
import { shim} from '../support/shim-document';

registerSuite(function () {
	let doc: Document;

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

	function createDocument(): Document {
		let doc: Document;

		const defaultDoc = shim || document;
		if (typeof defaultDoc.implementation.createHTMLDocument === 'function') {
			doc = defaultDoc.implementation.createHTMLDocument('');
		}
		else {
			const doctype = defaultDoc.implementation.createDocumentType('html', '', '');
			doc = defaultDoc.implementation.createDocument('', 'html', doctype);
			doc.body = <HTMLElement> doc.createElementNS('http://www.w3.org/1999/xhtml', 'body');
		}

		return doc;
	}

	return {
		name: 'src/parser',
		setup: function () {
			doc = shim || document;
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

				const foo = handle.factory();
				assert(foo.node, 'There is something assigned to foo.node');
				assert.strictEqual(foo.node.tagName.toLowerCase(), 'my-foo',
					'Constructor creates a node with the right tagName');
				assert.strictEqual(handle.factory.prototype, proto,
					'The passed prototype is the constructors prototype');

				const foo1 = handle.factory(<HTMLElement> null, {
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

				const instance = handle.factory();
				assert.instanceOf(instance, Foo, 'instance is an instance of Foo');
				handle.destroy();
			},
			'Ctor': function () {
				interface FooType extends ParserObject {
					foo: string;
				}

				interface FooConstructor {
					new (node?: HTMLElement, object?: any): FooType;
					prototype: FooType;
				}

				function Foo(node?: HTMLElement, object?: any): FooType {
					return;
				}

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
				const instance = handle.factory();
				assert.instanceOf(instance, Foo, 'instance is an instance of Foo');
				handle.destroy();
			},
			'factory': function () {
				const proto = {
					id: <string> undefined,
					node: <HTMLElement> undefined,
					foo: 'foo'
				};

				const factory = function factory(node: HTMLElement, options?: any): typeof proto {
					return Object.create(proto);
				};

				const handle = register('my-foo', {
					factory: factory,
					doc: doc
				});
				const instance = handle.factory();
				assert.strictEqual(factory, handle.factory, 'factory should be passed through');
				assert.strictEqual(instance.foo, 'foo', 'created with right prototype');
				handle.destroy();
			},
			'map': function () {
				const proto = {
					id: <string> undefined,
					node: <HTMLElement> undefined,
					baz: true
				};

				interface QatType extends ParserObject {
					node: HTMLElement;
					id: string;
					qat: boolean;
				}

				const factory = function factory(node: HTMLElement, options?: any): QatType {
					return Object.create({
						node: undefined,
						id: undefined,
						qat: true
					});
				};

				const handle = register({
					'my-foo': { Ctor: Foo, doc: doc },
					'my-bar': { Ctor: Bar, doc: doc },
					'my-baz': { proto: proto, doc: doc },
					'my-qat': { factory: factory, doc: doc }
				});
				const foo: Foo = handle.factories['my-foo'](null);
				const bar: Bar = handle.factories['my-bar'](null);
				const baz: typeof proto = handle.factories['my-baz'](null);
				const qat: QatType = handle.factories['my-qat'](null);
				assert.instanceOf(foo, Foo, 'foo is instance of Foo');
				assert.instanceOf(bar, Bar, 'bar is instance of Bar');
				assert.isTrue(baz.baz, 'baz.baz is true');
				assert.isTrue(qat.qat, 'qat.qat is true');
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
		},
		'byId': {
			'implied document': function () {
				if (typeof document === 'undefined') {
					this.skip('Environment does not have global document');
				}

				assert.instanceOf(byId('myFoo1'), Foo, 'Instance retrieved and right type');
				assert.instanceOf(byId('myBar1'), Bar, 'Instance retrieved and right type');
				assert.isUndefined(byId('foo'), 'Returns undefined when ID not present');
			},

			'explicit document': function () {
				const doc: Document = createDocument();
				const body: HTMLElement = doc.body;

				body.innerHTML = `<div>
					<my-foo id="myFoo1"></my-foo>
				</div>`;

				const handle = register('my-foo', {
					Ctor: Foo,
					doc: doc
				});

				return parse({ root: doc }).then(function () {
					assert.instanceOf(byId(doc, 'myFoo1'), Foo, 'Instance retrieved and right type');
					assert.notStrictEqual(byId(doc, 'myFoo1'), byId(createDocument(), 'myFoo1'),
						'Instances retrieved from different documents and different objects.');
					assert.isUndefined(byId(doc, 'foo'), 'Returns undefined when ID not present');
					handle.destroy();
				});
			}
		},
		'byNode': function () {
			doc.body.innerHTML = '';
			const myFooNode = doc.createElement('my-foo');
			const myBarNode = doc.createElement('div');
			myBarNode.setAttribute('is', 'my-bar');

			doc.body.appendChild(myFooNode);
			doc.body.appendChild(myBarNode);

			const handle = register({
				'my-foo': { Ctor: Foo, doc: doc },
				'my-bar': { Ctor: Bar, doc: doc }
			});

			return parse({ root: doc }).then(function (results) {
				assert.strictEqual(results.length, 2, '2 objects instantiated');
				assert.strictEqual(byNode(myFooNode), results[0], 'the right object is retrieved');
				assert.strictEqual(byNode(myBarNode), results[1], 'the right object is retrieved');
				handle.destroy();
			});
		},
		'remove': function () {
			doc.body.innerHTML = `<div is="my-foo" id="myFoo5"></div>`;
			const myFooNode = doc.createElement('my-foo');
			myFooNode.id = 'myFoo6';
			doc.body.appendChild(myFooNode);

			const handle = register('my-foo', { Ctor: Foo, doc: doc });

			return parse({ root: doc }).then(function (results) {
				const myFoo5 = byId(doc, 'myFoo5');
				const myFoo6 = byNode(myFooNode);
				assert(myFoo5, 'an object retrieved');
				assert(myFoo6, 'an object retrieved');
				remove(myFoo5);
				remove(myFoo6);
				assert.isUndefined(byId(doc, 'myFoo5'), 'byId returns undefined');
				assert.isUndefined(byNode(myFooNode), 'byNode returns undefined');
				handle.destroy();
			});
		},
		'watching': {
			'implied doc': function () {
				if (typeof document === 'undefined') {
					this.skip('Environment does not have global document');
				}

				const dfd = this.async(500);

				doc.body.innerHTML = '';
				const foo = doc.createElement('my-foo');

				const handle = register('my-foo', { Ctor: Foo });
				const watchHandle = watch();
				doc.body.appendChild(foo);
				setTimeout(dfd.callback(function () {
					const instance = byNode(foo);
					assert.instanceOf(instance, Foo, 'object was instantiated');
					handle.destroy();
					watchHandle.destroy();
				}), 100);
			},
			'instantiation': function () {
				const dfd = this.async(500);

				doc.body.innerHTML = `<div>
					<my-foo id="foo1"></my-foo>
					<div id="foo2"></div>
				</div>`;
				const foo1 = <HTMLElement> doc.getElementById('foo1');
				const foo2 = <HTMLElement> doc.getElementById('foo2');
				const foo3 = doc.createElement('my-foo');
				foo3.id = 'foo3';

				const handle = register('my-foo', { Ctor: Foo, doc: doc });

				const watchHandle = watch({ root: doc });
				doc.body.appendChild(foo3);
				doc.body.firstChild.removeChild(foo1);
				foo2.setAttribute('is', 'my-foo');
				setTimeout(dfd.callback(function () {
					const myFoo3byNode = byNode(foo3);
					const myFoo3byId = byId(doc, 'foo3');
					assert.instanceOf(myFoo3byNode, Foo, 'instanted object referenced by node');
					assert.instanceOf(myFoo3byId, Foo, 'instanted object referenced by node');
					assert.strictEqual(myFoo3byNode, myFoo3byId, 'reference objects are correct');
					assert.isUndefined(byId(doc, 'foo1'), 'no object instantiated');
					assert.isUndefined(byId(doc, 'foo2'), 'no object instantiated');
					assert.isUndefined(byNode(foo1), 'no object instantiated');
					assert.isUndefined(byNode(foo2), 'no object instantiated');
					watchHandle.destroy();
					handle.destroy();
				}), 100);
			},
			'removal': function () {
				const dfd = this.async(500);

				doc.body.innerHTML = '';
				const foo4 = doc.createElement('my-foo');
				foo4.id = 'foo4';
				const foo5 = doc.createElement('div');
				foo5.setAttribute('is', 'my-foo');
				foo5.id = 'foo5';
				doc.body.appendChild(foo4);
				doc.body.appendChild(foo5);

				const handle = register('my-foo', { Ctor: Foo, doc: doc });

				parse({ root: doc }).then(function (results) {
					assert.strictEqual(results.length, 2, '2 objects instantiated');
					assert(byId(doc, 'foo4'), 'foo4 exists');
					assert(byId(doc, 'foo5'), 'foo5 exists');
					assert(byNode(foo4), 'foo4 exists');
					assert(byNode(foo5), 'foo5 exists');
					handle.destroy();
					const watchHandle = watch({ root: doc });
					while (doc.body.lastChild) {
						doc.body.removeChild(doc.body.lastChild);
					}
					setTimeout(dfd.callback(function () {
						assert.isUndefined(byId(doc, 'foo4'), 'foo4 removed');
						assert.isUndefined(byId(doc, 'foo5'), 'foo5 removed');
						assert.isUndefined(byNode(foo4), 'foo4 removed');
						assert.isUndefined(byNode(foo5), 'foo5 removed');
						watchHandle.destroy();
					}), 100);
				}).catch(dfd.reject);
			},
			'double watch': function () {
				const watchHandle = watch({ root: doc });
				assert.throws(function () {
					watch({ root: doc });
				}, Error, 'Only one active parser watch at any given time.');

				watchHandle.destroy();

				/* now shouldn't throw */
				const watchHandle2 = watch({ root: doc });
				watchHandle2.destroy();
			},
			'callback': function () {
				const dfd = this.async(500);
				let watchHandle: Handle;
				let handle: RegistrationHandle<any, any>;
				let callbackCount = 0;

				const foo6 = doc.createElement('my-foo');
				const foo7 = doc.createElement('div');
				foo7.setAttribute('is', 'my-foo');

				function callback(changes: WatchChanges): void {
					callbackCount++;
					if (callbackCount === 1) {
						assert.strictEqual(changes.added.length, 2, 'two objects were added');
						assert.strictEqual(changes.removed.length, 0, 'no objects were removed');
						assert(byNode(foo6), 'object in registry');
						assert(byNode(foo7), 'object in registry');
						while (doc.body.lastChild) {
							doc.body.removeChild(doc.body.lastChild);
						}
					}
					else if (callbackCount === 2) {
						assert.strictEqual(changes.added.length, 0, 'no objects were added');
						assert.strictEqual(changes.removed.length, 2, 'two objects were removed');
						assert.isUndefined(byNode(foo6), 'object not in registry');
						assert.isUndefined(byNode(foo7), 'object not in registry');
						handle.destroy();
						watchHandle.destroy();
						/* doing this to ensure callback does not get called again */
						setTimeout(dfd.resolve, 50);
					}
					else {
						throw new Error('Callback called too many times');
					}
				}

				while (doc.body.lastChild) {
					doc.body.removeChild(doc.body.lastChild);
				}

				watchHandle = watch({ root: doc, callback: callback });

				handle = register('my-foo', { Ctor: Foo, doc: doc });

				doc.body.appendChild(foo6);
				doc.body.appendChild(foo7);
			},
			'sub body watching': function () {
				const dfd = this.async();

				const div1 = doc.createElement('div');
				const div2 = doc.createElement('div');
				doc.body.appendChild(div1);
				doc.body.appendChild(div2);

				const watchHandle = watch({ root: div1, callback: callback });

				const handle = register('my-foo', { Ctor: Foo, doc: doc });

				let callbackCount = 0;

				function callback(changes: WatchChanges) {
					callbackCount++;
					if (callbackCount === 1) {
						assert.strictEqual(changes.added.length, 1, 'only one object added');
						assert.strictEqual(changes.removed.length, 0, 'no objects removed');
						assert.instanceOf(byId(doc, 'foo8'), Foo, 'foo8 exists and is proper type');
						assert.isUndefined(byId(doc, 'foo9'), 'foo9 does not exist');
						div1.removeChild(div1.firstChild);
						div2.removeChild(div2.firstChild);
					}
					else if (callbackCount === 2) {
						assert.strictEqual(changes.added.length, 0, 'no objects added');
						assert.strictEqual(changes.removed.length, 1, 'one object removed');
						assert.isUndefined(byId(doc, 'foo8'), 'foo8 no longer registered');
						handle.destroy();
						watchHandle.destroy();
						/* doing this to just make sure callback does not get called again */
						setTimeout(dfd.resolve, 50);
					}
					else {
						throw new Error('callback called too many times');
					}
				}

				div1.innerHTML = `<my-foo id="foo8"></my-foo>`;
				div2.innerHTML = `<my-foo id="foo9"></my-foo>`;
			}
		}
	};
});
