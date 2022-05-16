export default class Match extends Array {
	patternId;
	groups;

	constructor(m, patternId) {
		super();
		this.patternId = patternId;
		this.push(...Array.from(m).slice(1));
		if (m.groups) {
			this.groups = m.groups;
		}
		else {
			delete this.groups;
		}
	}
}
