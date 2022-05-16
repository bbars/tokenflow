const ROOT_NAME = Symbol('root');

export default class Context extends Array {
	static get ROOT_NAME() {
		return ROOT_NAME;
	}
	ctxName;
	parent;

	constructor(ctxName, parent) {
		super();
		this.ctxName = ctxName;
		Object.defineProperties(this, {
			parent: {
				value: parent,
				enumerable: false,
			},
		});
	}

	closest(ctxName) {
		let ctx = this;
		while (ctx) {
			if (ctx.ctxName === ctxName) {
				return ctx.parent;
			}
			ctx = ctx.parent;
		}
		return null;
	}

	isRoot() {
		return this.ctxName === this.constructor.ROOT_NAME;
	}

	static createRoot() {
		return new this(this.ROOT_NAME);
	}

	walkTree(callback) {
		for (const item of this) {
			if (item instanceof Context) {
				item.walkTree(callback);
			}
		}
		callback(this);
	}
}
