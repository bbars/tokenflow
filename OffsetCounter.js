const CRLF = /\r\n|\n|\r/;

export default class OffsetCounter {
	offset = 0;
	line = 1;
	col = 1;

	feed(s) {
		this.offset += s.length;
		const lines = s.split(CRLF);
		if (lines.length === 1) {
			this.col += s.length;
		}
		else {
			this.line += lines.length - 1;
			this.col = 1 + lines[lines.length - 1].length;
		}
		return this;
	}

	toString() {
		return `${this.line}:${this.col}`;
	}

	valueOf() {
		return this.offset;
	}
}
