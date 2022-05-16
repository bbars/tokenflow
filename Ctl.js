export default class Ctl {
	expectations;
	extras;

	constructor(expectations, extras = {}) {
		this.expectations = expectations;
		this.extras = extras;
	}

	static ensure(value) {
		if (value instanceof this) {
			return value;
		}
		value = value instanceof Array ? value : [].concat(value);
		return new this(value);
	}

	getExpectIds() {
		return this.expectations instanceof Array
			? Array.from(this.expectations)
			: Object.keys(this.expectations)
		;
	}
}
