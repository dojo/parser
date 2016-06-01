import has, { add, normalize, load } from 'dojo-core/has';

add('dom3-mutation-observer', typeof MutationObserver !== 'undefined');

export default has;
export { normalize, load };
