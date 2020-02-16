class Cols {
  constructor({ len, width, indexWidth, minWidth }) {
    this._ = {};
    this.len = len;
    this.width = width;
    this.indexWidth = indexWidth;
    this.minWidth = minWidth;
  }

  setData(d) {
    if (d.len) {
      this.len = d.len;
      delete d.len;
    }
    this._ = d;
  }

  getData() {
    const { len } = this;
    return Object.assign({ len }, this._);
  }

  getWidth(i) {
    const col = this._[i];
    if (col && col.width) {
      return col.width;
    }
    return this.width;
  }

  getOrNew(colIndex) {
    this._[colIndex] = this._[colIndex] || {};
    return this._[colIndex];
  }

  setWidth(colIndex, width) {
    const col = this.getOrNew(colIndex);
    col.width = width;
  }

  setStyle(colIndex, style) {
    const col = this.getOrNew(colIndex);
    col.style = style;
  }

  sumWidth(min, max) {
    return _.reduce(
      _.range(min + 1, max + 1),
      (sum, value) => {
        return sum + this.getWidth(value - 1);
      },
      0,
    );
  }

  totalWidth() {
    return this.sumWidth(0, this.len);
  }
}

export default {};
export { Cols };
