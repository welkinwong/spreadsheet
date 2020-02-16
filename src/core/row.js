import { expr2expr } from './alphabet';

class Rows {
  constructor({ len, height }) {
    this._ = {};
    this.len = len;
    // default row height
    this.height = height;
  }

  getHeight(rowIndex) {
    const row = this.get(rowIndex);
    if (row && row.height) {
      return row.height;
    }
    return this.height;
  }

  setHeight(rowIndex, v) {
    const row = this.getOrNew(rowIndex);
    row.height = v;
  }

  setStyle(rowIndex, style) {
    const row = this.getOrNew(rowIndex);
    row.style = style;
  }

  sumHeight(min, max, exceptSet) {
    return _.reduce(
      _.range(min + 1, max + 1),
      (sum, value) => {
        if (exceptSet && exceptSet.has(value - 1)) return sum;

        return sum + this.getHeight(value - 1);
      },
      0,
    );
  }

  totalHeight() {
    return this.sumHeight(0, this.len);
  }

  get(rowIndex) {
    return this._[rowIndex];
  }

  getOrNew(rowIndex) {
    this._[rowIndex] = this._[rowIndex] || { cells: {} };
    return this._[rowIndex];
  }

  getCell(rowIndex, colIndex) {
    const row = this.get(rowIndex);
    if (
      row !== undefined &&
      row.cells !== undefined &&
      row.cells[colIndex] !== undefined
    ) {
      return row.cells[colIndex];
    }
    return null;
  }

  getCellMerge(rowIndex, colIndex) {
    const cell = this.getCell(rowIndex, colIndex);
    if (cell && cell.merge) return cell.merge;
    return [0, 0];
  }

  getCellOrNew(rowIndex, colIndex) {
    const row = this.getOrNew(rowIndex);
    row.cells[colIndex] = row.cells[colIndex] || {};
    return row.cells[colIndex];
  }

  // what: all | text | format
  setCell(rowIndex, colIndex, cell, what = 'all') {
    const row = this.getOrNew(rowIndex);
    if (what === 'all') {
      row.cells[colIndex] = cell;
    } else if (what === 'text') {
      row.cells[colIndex] = row.cells[colIndex] || {};
      row.cells[colIndex].text = cell.text;
    } else if (what === 'format') {
      row.cells[colIndex] = row.cells[colIndex] || {};
      row.cells[colIndex].style = cell.style;
      if (cell.merge) row.cells[colIndex].merge = cell.merge;
    }
  }

  setCellText(rowIndex, colIndex, text) {
    const cell = this.getCellOrNew(rowIndex, colIndex);
    cell.text = text;
  }

  // what: all | format | text
  copyPaste(
    srcCellRange,
    dstCellRange,
    what,
    autofill = false,
    callback = () => {},
  ) {
    const { sri, sci, eri, eci } = srcCellRange;
    const dsri = dstCellRange.sri;
    const dsci = dstCellRange.sci;
    const deri = dstCellRange.eri;
    const deci = dstCellRange.eci;
    const [rn, cn] = srcCellRange.size();
    const [drn, dcn] = dstCellRange.size();
    // console.log(srcIndexes, dstIndexes);
    let isAdd = true;
    let dn = 0;
    if (deri < sri || deci < sci) {
      isAdd = false;
      if (deri < sri) dn = drn;
      else dn = dcn;
    }
    // console.log('drn:', drn, ', dcn:', dcn, dn, isAdd);
    for (let i = sri; i <= eri; i += 1) {
      if (this._[i]) {
        for (let j = sci; j <= eci; j += 1) {
          if (this._[i].cells && this._[i].cells[j]) {
            for (let ii = dsri; ii <= deri; ii += rn) {
              for (let jj = dsci; jj <= deci; jj += cn) {
                const nri = ii + (i - sri);
                const nci = jj + (j - sci);
                const ncell = _.cloneDeep(this._[i].cells[j]);
                // ncell.text
                if (autofill && ncell && ncell.text && ncell.text.length > 0) {
                  const { text } = ncell;
                  let n = jj - dsci + (ii - dsri) + 2;
                  if (!isAdd) {
                    n -= dn + 1;
                  }
                  if (text[0] === '=') {
                    ncell.text = text.replace(/\width{1,3}\d/g, word => {
                      let [xn, yn] = [0, 0];
                      if (sri === dsri) {
                        xn = n - 1;
                        // if (isAdd) xn -= 1;
                      } else {
                        yn = n - 1;
                      }
                      // console.log('xn:', xn, ', yn:', yn, word, expr2expr(word, xn, yn));
                      return expr2expr(word, xn, yn);
                    });
                  } else {
                    const result = /[\\.\d]+$/.exec(text);
                    // console.log('result:', result);
                    if (result !== null) {
                      const index = Number(result[0]) + n - 1;
                      ncell.text = text.substring(0, result.index) + index;
                    }
                  }
                }
                // console.log('ncell:', nri, nci, ncell);
                this.setCell(nri, nci, ncell, what);
                callback(nri, nci, ncell);
              }
            }
          }
        }
      }
    }
  }

  cutPaste(srcCellRange, dstCellRange) {
    const ncellmm = {};
    this.each(rowIndex => {
      this.eachCells(rowIndex, colIndex => {
        let nri = parseInt(rowIndex, 10);
        let nci = parseInt(colIndex, 10);
        if (srcCellRange.includes(rowIndex, colIndex)) {
          nri = dstCellRange.sri + (nri - srcCellRange.sri);
          nci = dstCellRange.sci + (nci - srcCellRange.sci);
        }
        ncellmm[nri] = ncellmm[nri] || { cells: {} };
        ncellmm[nri].cells[nci] = this._[rowIndex].cells[colIndex];
      });
    });
    this._ = ncellmm;
  }

  // src: Array<Array<String>>
  paste(src, dstCellRange) {
    if (src.length <= 0) return 0;
    const { sri, sci } = dstCellRange;
    src.forEach((row, i) => {
      const rowIndex = sri + i;
      row.forEach((cell, j) => {
        const colIndex = sci + j;
        this.setCellText(rowIndex, colIndex, cell);
      });
    });
  }

  insert(sri, n = 1) {
    const ndata = {};
    this.each((rowIndex, row) => {
      let nri = parseInt(rowIndex, 10);
      if (nri >= sri) {
        nri += n;
      }
      ndata[nri] = row;
    });
    this._ = ndata;
    this.len += n;
  }

  delete(sri, eri) {
    const n = eri - sri + 1;
    const ndata = {};
    this.each((rowIndex, row) => {
      const nri = parseInt(rowIndex, 10);
      if (nri < sri) {
        ndata[nri] = row;
      } else if (rowIndex > eri) {
        ndata[nri - n] = row;
      }
    });
    this._ = ndata;
    this.len -= n;
  }

  insertColumn(sci, n = 1) {
    this.each((rowIndex, row) => {
      const rndata = {};
      this.eachCells(rowIndex, (colIndex, cell) => {
        let nci = parseInt(colIndex, 10);
        if (nci >= sci) {
          nci += n;
        }
        rndata[nci] = cell;
      });
      row.cells = rndata;
    });
  }

  deleteColumn(sci, eci) {
    const n = eci - sci + 1;
    this.each((rowIndex, row) => {
      const rndata = {};
      this.eachCells(rowIndex, (colIndex, cell) => {
        const nci = parseInt(colIndex, 10);
        if (nci < sci) {
          rndata[nci] = cell;
        } else if (nci > eci) {
          rndata[nci - n] = cell;
        }
      });
      row.cells = rndata;
    });
  }

  // what: all | text | format | merge
  deleteCells(cellRange, what = 'all') {
    cellRange.each((i, j) => {
      this.deleteCell(i, j, what);
    });
  }

  // what: all | text | format | merge
  deleteCell(rowIndex, colIndex, what = 'all') {
    const row = this.get(rowIndex);
    if (row !== null) {
      const cell = this.getCell(rowIndex, colIndex);
      if (cell !== null) {
        if (what === 'all') {
          delete row.cells[colIndex];
        } else if (what === 'text') {
          if (cell.text) delete cell.text;
          if (cell.value) delete cell.value;
        } else if (what === 'format') {
          if (cell.style !== undefined) delete cell.style;
          if (cell.merge) delete cell.merge;
        } else if (what === 'merge') {
          if (cell.merge) delete cell.merge;
        }
      }
    }
  }

  each(callback) {
    Object.entries(this._).forEach(([rowIndex, row]) => {
      callback(rowIndex, row);
    });
  }

  eachCells(rowIndex, callback) {
    if (this._[rowIndex] && this._[rowIndex].cells) {
      Object.entries(this._[rowIndex].cells).forEach(([colIndex, cell]) => {
        callback(colIndex, cell);
      });
    }
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
}

export default {};
export { Rows };
