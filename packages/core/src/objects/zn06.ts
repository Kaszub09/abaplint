import {AbstractObject} from "./_abstract_object";

export class ZN06 extends AbstractObject {

  public getType(): string {
    return "ZN06";
  }

  public getAllowedNaming() {
    return { // todo, verify
      maxLength: 30,
      allowNamespace: true,
    };
  }

  public getDescription(): string | undefined {
    // todo
    return undefined;
  }
}