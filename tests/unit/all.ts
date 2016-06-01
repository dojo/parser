import './parser';
import './watch';

import { patchGlobalConstructor} from '../support/shim-document';

patchGlobalConstructor();
