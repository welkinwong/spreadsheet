import { CellRange } from './cell_range';

export default class Selector {
  constructor() {
    this.range = new CellRange(0, 0, 0, 0);
    this.rowIndex = 0;
    this.colIndex = 0;
  }

  multiple() {
    return this.range.multiple();
  }

  setIndexes(rowIndex, colIndex) {
    this.rowIndex = rowIndex;
    this.colIndex = colIndex;
  }

  size() {
    return this.range.size();
  }
}
