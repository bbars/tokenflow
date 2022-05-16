import Context from './Context.js';
import Ctl from './Ctl.js';
import Match from './Match.js';
import Token from './Token.js';
import OffsetCounter from './OffsetCounter.js';

export default class Tokenizer extends Context {
	patterns = {};
	ctlResolver = null;
	rootCtl = null;

	constructor() {
		super(Context.ROOT_NAME);
	}

	definePatterns(patterns) {
		for (const patternId in patterns) {
			if (this.patterns[patternId]) {
				throw new Error(`Pattern #${patternId} already defined`);
			}
		}
		for (const patternId in patterns) {
			let pattern = patterns[patternId];
			if (!(pattern instanceof RegExp)) {
				throw new Error(`Pattern must be an instanceof RegExp`);
			}
			pattern = new RegExp(pattern.source, 'yg' + pattern.flags.replace(/[yg]/g, ''));
			this.patterns[patternId] = pattern;
		}
		return this;
	}

	getPattern(id) {
		if (id === this) {
			return this;
		}
		if (id instanceof RegExp && Object.values(this.patterns).indexOf(id) > -1) {
			return id;
		}
		if (!this.patterns[id]) {
			throw new Error(`Unknown Pattern #${id}`);
		}
		return this.patterns[id];
	}

	getPatterns(ids) {
		return ids.reduce((res, id) => {
			res[id] = this.getPattern(id);
			return res;
		}, {});
	}

	setCtlResolver(ctlResolver) {
		this.ctlResolver = ctlResolver;
		return this;
	}

	setRootCtl(rootCtl) {
		this.rootCtl = rootCtl;
		return this;
	}

	process(str, startingCtl = null, lastIndex = 0) {
		for (const token of this.iterate(str, startingCtl, lastIndex, this)) {
			continue;
		}
		return this;
	}

	*iterate(str, startingCtl = null, lastIndex = 0, rootContext = null) {
		let ctx = rootContext || Context.createRoot();
		lastIndex = +lastIndex;
		let prevId = '/';
		let ctl = Ctl.ensure(startingCtl || this.rootCtl);
		while (ctl) {
			const expectPatterns = ctl.expectations instanceof Array
				? this.getPatterns(ctl.expectations)
				: ctl.expectations
			;
			let m;
			let patternId;
			let pattern;
			for (patternId in expectPatterns) {
				pattern = expectPatterns[patternId];
				
				pattern.lastIndex = lastIndex;
				m = pattern.exec(str);
				if (m) {
					lastIndex = pattern.lastIndex;
					break;
				}
			}
			if (patternId == null) {
				return null;
			}
			
			if (!m) {
				if (lastIndex < str.length) {
					const offsetCounter = new OffsetCounter().feed(str.slice(0, lastIndex));
					let near = ''
						+ str.slice(lastIndex - 10, lastIndex)
						+ '<HERE>'
						+ str.slice(lastIndex, lastIndex + 10)
					;
					throw new Error(`Unexpected token at ${offsetCounter} near ${JSON.stringify(near)}; expectations: ${prevId} -> ${ctl.getExpectIds().join(', ')}`);
				}
				if (!ctx.isRoot()) {
					throw new Error(`Unexpected end of input; expectations: ${prevId} -> ${ctl.getExpectIds().join(', ')}`);
				}
				break;
			}
			
			const token = new Token({ m, patternId, pattern, lastIndex, ctx });
			
			ctl = this.ctlResolver(token);
			
			yield token;
			
			if (!ctl) {
				if (lastIndex < str.length) {
					const offsetCounter = new OffsetCounter().feed(str.slice(0, lastIndex));
					throw new Error(`No expectations after ${patternId} at ${offsetCounter}`);
				}
				break;
			}
			
			if (ctl.extras.prePop && ctl.extras.prePop.length) {
				for (const ctxName of [].concat(ctl.extras.prePop)) {
					ctx = ctx.closest(ctxName);
					if (!ctx) {
						const offsetCounter = new OffsetCounter().feed(str.slice(0, lastIndex));
						throw new Error(`Wrong context after ${patternId} at ${offsetCounter}`);
					}
				}
			}
			
			if (ctl.extras.prePush && ctl.extras.prePush.length) {
				for (const ctxName of [].concat(ctl.extras.prePush)) {
					ctx = new Context(ctxName, ctx);
					ctx.parent.push(ctx);
				}
			}
			
			if (rootContext && (m.length > 1 || m.groups || ctl.extras.wrap)) {
				const match = new Match(m, patternId);
				if (!ctl.extras.wrap) {
					ctx.push(match);
				}
				else {
					const wrapper = new Context(ctl.extras.wrap, ctx);
					wrapper.push(match);
					ctx.push(wrapper);
				}
			}
			
			ctx.lastCtl = ctl;
			
			if (ctl.extras.postPop && ctl.extras.postPop.length) {
				for (const ctxName of [].concat(ctl.extras.postPop)) {
					ctx = ctx.closest(ctxName);
					if (!ctx) {
						const offsetCounter = new OffsetCounter().feed(str.slice(0, lastIndex));
						throw new Error(`Wrong context after ${patternId} at ${offsetCounter}`);
					}
				}
			}
			
			if (ctl.extras.postPush && ctl.extras.postPush.length) {
				for (const ctxName of [].concat(ctl.extras.postPush)) {
					ctx = new Context(ctxName, ctx);
					ctx.parent.push(ctx);
				}
			}
			
			if (ctl.expectations === true) {
				ctl = ctx.lastCtl;
			}
			
			prevId = patternId;
		}
	}
}
