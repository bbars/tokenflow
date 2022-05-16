export default class Token {
	m;
	patternId;
	pattern;
	lastIndex;
	ctx;

	constructor(values) {
		Object.assign(this, values);
	}
}
