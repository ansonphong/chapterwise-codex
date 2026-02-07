import { vi } from 'vitest';

export const window = {
  showQuickPick: vi.fn(),
  showInputBox: vi.fn(),
  showErrorMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  showInformationMessage: vi.fn(),
  setStatusBarMessage: vi.fn(),
};

export const workspace = {
  applyEdit: vi.fn().mockResolvedValue(true),
};

export class WorkspaceEdit {
  private _edits: Array<{ uri: any; range: any; newText: string }> = [];
  replace(uri: any, range: any, newText: string) {
    this._edits.push({ uri, range, newText });
  }
}

export class Range {
  constructor(
    public startLine: number,
    public startChar: number,
    public endLine: number,
    public endChar: number
  ) {}
}

export class ThemeIcon {
  constructor(public id: string, public color?: ThemeColor) {}
}

export class ThemeColor {
  constructor(public id: string) {}
}

export class Uri {
  static file(p: string) { return { fsPath: p, scheme: 'file', path: p }; }
}
