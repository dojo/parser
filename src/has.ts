import coreHas, { add as hasAdd } from 'dojo-core/has';

hasAdd('dom3-mutation-observer', typeof MutationObserver !== 'undefined');

interface Package {
	location?: string;
	main?: string;
	name?: string;
}

interface ModuleMapItem {
	[mid: string]: /*IModuleMapReplacement|IModuleMap*/any;
}

interface ModuleMap extends ModuleMapItem {
	[sourceMid: string]: ModuleMapReplacement;
}

interface ModuleMapReplacement extends ModuleMapItem {
	[findMid: string]: /* replaceMid */string;
}

interface Config {
	baseUrl?: string;
	map?: ModuleMap;
	packages?: Package[];
	paths?: { [path: string]: string; };
}

interface RequireCallback {
	(...modules: any[]): void;
}

interface Require {
	(config: Config, dependencies?: string[], callback?: RequireCallback): void;
	(dependencies: string[], callback: RequireCallback): void;
	<T>(moduleId: string): T;

	toAbsMid(moduleId: string): string;
	toUrl(path: string): string;
}

interface Has {
	(name: string): any;
	add(feature: string, value: any, overwrite?: boolean): void;
	normalize(resourceId: string, normalize: (moduleId: string) => string): string;
	load(resourceId: string, require: Require, load: (value?: any) => void): void;
}

const has: Has = <Has> function has(...args: any[]): any {
	return coreHas.apply(this, args);
};

has.normalize = function (resourceId: string, normalize: (moduleId: string) => string): string {
	const tokens = resourceId.match(/[\?:]|[^:\?]*/g);

	let i = 0;
	function get(skip?: boolean): string {
		const term = tokens[i++];
		if (term === ':') {
			// empty string module name, resolves to 0
			return null;
		}
		else {
			// postfixed with a ? means it is a feature to branch on, the term is the name of the feature
			if (tokens[i++] === '?') {
				if (!skip && has(term)) {
					// matched the feature, get the first value from the options
					return get();
				}
				else {
					// did not match, get the second value, passing over the first
					get(true);
					return get(skip);
				}
			}

			// a module
			return term;
		}
	}

	resourceId = get();
	return resourceId && normalize(resourceId);
};

has.load = function (resourceId: string, require: Require, load: (value?: any) => void): void {
	if (resourceId) {
		require([ resourceId ], load);
	}
	else {
		load();
	}
};

export = has;
