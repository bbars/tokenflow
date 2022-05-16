# tokenizerflow
Tokenize string using declared patterns and additional flow-control rules

## Example

Parse PGN (Portable Game Notation):

### Extend Tokenizer to specify patterns and flow-control rules
```javascript
import * as tokenizerflow from 'tokenizerflow';

class PgnTokenizer extends tokenizerflow.Tokenizer {
	conf;

	constructor(conf = {}) {
		super();
		
		this.conf = Object.assign({
			singleDocument: false,
		}, conf);
		
		this.definePatterns({
			headerOpen: /[\n\s]*\[/,
			headerName: /([^\s\]]+)\s*/,
			
			strOpen: /"/,
			strBsBs: /([^"]*?\\\\)/,
			strBsQ: /([^"]*?\\")/,
			strAny: /([^"]+)/,
			strClose: /"/,
			
			headerClose: /\s*\][\s\n]+/,
			
			body: /[\n\s]*/,
			
			moveNumber: /\s*(\d+)(\.+)/,
			moveText: /\s*((?<movemut>(?<srcdst>o-o-o|o-o|[a-z0-9]+)(?<mut>=[a-z])?)(?<ext>[\?!#\+]+)?)/i,
			
			commentOpen: /\s*\{/,
			commentContents: /\s*([^}]*?)(?=\s*\})/,
			commentClose: /\s*\}/,
			
			altOpen: /\s*\(/,
			altClose: /\s*\)/,
			
			end: /\s*(\d\/\d-\d\/\d|\d-\d\/\d|\d\/\d-\d|0-1|1-0|1|0|\*)/,
			
			eof: /[\s\n]*$/,
		});
		
		if (!this.conf.singleDocument) {
			this.definePatterns({
				documentSeparator: /\r\n\r\n|\n\n/,
				documentWeakSeparator: /\r\n|\n/,
			});
		}
		
		this.setCtlResolver(this._resolveCtl.bind(this));
		
		this.setRootCtl(['headerOpen', 'moveNumber']);
	}

	_resolveCtl(token) {
		const extras = {};
		switch (token.patternId) {
			case 'headerOpen':
				extras.prePush = extras.prePush || 'header';
				return new tokenizerflow.Ctl(['headerName'], extras);
			
			case 'headerName':
				return new tokenizerflow.Ctl(['strOpen'], extras);
			
			case 'strOpen':
				extras.prePush = extras.prePush || 'string';
			case 'strBsBs':
			case 'strBsQ':
			case 'strAny':
				return new tokenizerflow.Ctl(['strBsBs', 'strBsQ', 'strAny', 'strClose'], extras);
			
			case 'strClose':
				extras.postPop = extras.postPop || 'string';
				return token.ctx.parent.ctxName === 'header'
					? new tokenizerflow.Ctl(['headerClose'], extras)
					: null
				;
			
			case 'headerClose':
				extras.postPop = extras.postPop || 'header';
				return new tokenizerflow.Ctl(['headerOpen', /*'body',*/ 'moveNumber'], extras);
			
			case 'commentOpen':
				extras.prePush = extras.prePush || 'comment';
				return new tokenizerflow.Ctl(['commentContents'], extras);
			
			case 'commentContents':
				return new tokenizerflow.Ctl(['commentClose'], extras);
			
			case 'altOpen':
				extras.prePush = extras.prePush || 'alt';
				return new tokenizerflow.Ctl(['body'], extras);
			
			case 'body':
				return new tokenizerflow.Ctl(['moveNumber', 'end', 'moveText', 'commentOpen', 'altOpen', 'altClose', 'eof'], extras);
			
			case 'moveNumber':
				return new tokenizerflow.Ctl(['moveText'], extras);
			
			case 'end':
				return this.conf.singleDocument
					? new tokenizerflow.Ctl(['eof'], extras)
					: new tokenizerflow.Ctl(['documentSeparator', 'documentWeakSeparator', 'body'], extras)
				;
			
			case 'commentClose':
				extras.postPop = extras.postPop || 'comment';
			case 'altClose':
				extras.postPop = extras.postPop || 'alt';
			case 'moveText':
				return this.conf.singleDocument
					? new tokenizerflow.Ctl(['body'], extras)
					: new tokenizerflow.Ctl(['documentSeparator', 'body'], extras)
				;
			
			case 'documentSeparator':
			case 'documentWeakSeparator':
				return new tokenizerflow.Ctl(['headerOpen', 'moveNumber'], extras);
		}
	}
}
```

### Use PgnTokenizer to process string
```javascript
const pgnTokenizer = new PgnTokenizer({
	singleDocument: true,
});
const root = pgnTokenizer.process(getPgn());

// process tokenizer results:
import * as chess from '...';

let initialState;
let meta = {};
let history;

const fillHistory = (initialState, ctx, startingIndex = 0) => {
	const history = new chess.History(initialState);
	let prevMove;
	for (let i = startingIndex; i < ctx.length; i++) {
		const item = ctx[i];
		if (item instanceof tokenizerflow.Context && item.ctxName === 'comment') {
			prevMove.children.push(new chess.Comment(item[0][0]));
		}
		else if (item instanceof tokenizerflow.Context && item.ctxName === 'alt') {
			prevMove.children.push(fillHistory(null, item));
		}
		else if (item instanceof tokenizerflow.Match && item.patternId === 'moveNumber') {
			// TODO: check
		}
		else if (item instanceof tokenizerflow.Match && item.patternId === 'moveText') {
			prevMove = new chess.MoveAbbr(item);
			history.push(prevMove);
		}
	}
	return history;
};

for (let i = 0; i < root.length; i++) {
	const item = root[i];
	if (item instanceof tokenizerflow.Context && item.ctxName === 'header') {
		const headerName = item[0][0];
		const headerValue = item[1][0][0];
		if (meta[headerName] != null) {
			throw new Error(`Duplicate header '${headerName}'`);
		}
		meta[headerName] = headerValue;
		if (headerName.toUpperCase() === 'FEN') {
			initialState = headerValue;
		}
	}
	else {
		history = fillHistory(initialState || chess.State.createInitial(), root, i);
		break;
	}
}

console.log(meta, history);
```
