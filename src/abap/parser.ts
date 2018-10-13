import * as Tokens from "./tokens/";
import * as Statements from "./statements/";
import {Combi} from "./combi";
import {TokenNode} from "./node";
import {Statement, Unknown, Empty, Comment, MacroContent} from "./statements/statement";
import {Version} from "../version";
import {Artifacts} from "./artifacts";
import {Token} from "./tokens/";

function className(cla: any) {
  return (cla.constructor + "").match(/\w+/g)[1];
}

class Map {
  private map: {[index: string]: Array<string> };

  public constructor() {
    this.map = {};

    for (let stat of Artifacts.getStatements()) {
      const first = stat.getMatcher().first();

      if (this.map[first]) {
        this.map[first].push(className(stat));
      } else {
        this.map[first] = [className(stat)];
      }
    }
  }

  public lookup(token: Token): Array<string> {
    let res = this.map[token.getStr().toUpperCase()];
    res = res ? res.concat(this.map[""]) : this.map[""];
    return res;
  }
}

export default class Parser {
  private static statements: Array<Statement>;
// todo, move this map to separate local class
  private static map: Map;

  public static run(tokens: Array<Tokens.Token>, ver = Version.v750): Array<Statement> {
    this.statements = [];

    if (!this.map) {
      this.map = new Map();
    }

    this.process(tokens);
    this.categorize(ver);
// todo, also handle NativeSQL after EXECSQL statements
    this.macros();

    return this.statements;
  }

  private static tokensToNodes(tokens: Array<Tokens.Token>): Array<TokenNode> {
    let ret: Array<TokenNode> = [];

    tokens.forEach((t) => {ret.push(new TokenNode("Unknown", t)); });

    return ret;
  }

  private static macros() {
    let result: Array<Statement> = [];
    let define = false;

    for (let statement of this.statements) {
      if (statement instanceof Statements.Define) {
        define = true;
      } else if (statement instanceof Statements.EndOfDefinition) {
        define = false;
      } else if (!(statement instanceof Comment) && define === true) {
        statement = new MacroContent().setChildren(this.tokensToNodes(statement.getTokens()));
      }

      result.push(statement);
    }

    this.statements = result;
  }

  private static removeLast(tokens: Array<Tokens.Token>): Array<Tokens.Token> {
    let copy = tokens.slice();
    copy.pop();
    return copy;
  }

// for each statement, run statement matchers to figure out which kind of statement it is
  private static categorize(ver: Version) {
    let result: Array<Statement> = [];

    for (let statement of this.statements) {
      let length = statement.getTokens().length;
      let last = statement.getTokens()[length - 1];

      if (length === 1
          && last instanceof Tokens.Punctuation) {
        statement = new Empty().setChildren(this.tokensToNodes(statement.getTokens()));
      } else if (statement instanceof Unknown
          && last instanceof Tokens.Punctuation) {
        statement = this.match(statement, ver);
      }

      result.push(statement);
    }
    this.statements = result;
  }

  private static removePragma(tokens: Array<Tokens.Token>): Array<Tokens.Token> {
    return tokens.filter(function (value) { return !(value instanceof Tokens.Pragma); } );
  }

  private static match(statement: Statement, ver: Version): Statement {
    let tokens = statement.getTokens();
    let last = tokens[tokens.length - 1];
    tokens = this.removePragma(this.removeLast(tokens));
    if (tokens.length === 0) {
      return new Empty().setChildren(this.tokensToNodes(this.removePragma(statement.getTokens())));
    }

    for (let st of this.map.lookup(tokens[0])) {
      let match = Combi.run(Artifacts.newStatement(st).getMatcher(),
                            tokens,
                            ver);
      if (match) {
        return Artifacts.newStatement(st).setChildren(match.concat(new TokenNode("Terminator", last)));
      }
    }
    return statement;
  }

// takes care of splitting tokens into statements, also handles chained statements
  private static process(tokens: Array<Tokens.Token>) {
    let add: Array<Tokens.Token> = [];
    let pre: Array<Tokens.Token> = [];
    let ukn = (t: Tokens.Token[]) => { this.statements.push(new Unknown().setChildren(this.tokensToNodes(t))); };

    for (let token of tokens) {
      if (token instanceof Tokens.Comment) {
        this.statements.push(new Comment().setChildren(this.tokensToNodes([token])));
        continue;
      }

      add.push(token);
      if (token.getStr() === ".") {
        ukn(pre.concat(add));
        add = [];
        pre = [];
      } else if (token.getStr() === "," && pre.length > 0) {
        ukn(pre.concat(add));
        add = [];
      } else if (token.getStr() === ":") {
        add.pop(); // do not add colon token to statement
        pre = add.slice(0);
        add = [];
      }
    }

    if (add.length > 0) {
      ukn(pre.concat(add));
    }
  }
}