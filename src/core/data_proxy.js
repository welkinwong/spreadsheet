import Selector from './selector';
import Scroll from './scroll';
import AutoFilter from './auto_filter';
import { Merges } from './merge';
import { Rows } from './row';
import { Cols } from './col';
import { CellRange } from './cell_range';
import _ from 'lodash';
import { expr2xy, xy2expr } from './alphabet';

// private methods
/*
 * {
 *  name: ''
 *  freeze: [0, 0],
 *  formats: [],
 *  styles: [
 *    {
 *      bgcolor: '',
 *      align: '',
 *      valign: '',
 *      textwrap: false,
 *      strike: false,
 *      underline: false,
 *      color: '',
 *      format: 1,
 *      border: {
 *        left: [style, color],
 *        right: [style, color],
 *        top: [style, color],
 *        bottom: [style, color],
 *      },
 *      font: {
 *        name: 'Helvetica',
 *        size: 10,
 *        bold: false,
 *        italic: false,
 *      }
 *    }
 *  ],
 *  merges: [
 *    'A1:F11',
 *    ...
 *  ],
 *  rows: {
 *    1: {
 *      height: 50,
 *      style: 1,
 *      cells: {
 *        1: {
 *          style: 2,
 *          type: 'string',
 *          text: '',
 *          value: '', // cal result
 *        }
 *      }
 *    },
 *    ...
 *  },
 *  cols: {
 *    2: { width: 100, style: 1 }
 *  }
 * }
 */
const defaultSettings = {
  view: {
    height: () => document.documentElement.clientHeight,
    width: () => document.documentElement.clientWidth,
  },
  showGrid: true,
  showContextmenu: true,
  row: {
    len: 100,
    height: 25,
  },
  col: {
    len: 26,
    width: 100,
    indexWidth: 60,
    minWidth: 60,
  },
  style: {
    bgcolor: '#ffffff',
    align: 'left',
    valign: 'middle',
    textwrap: false,
    strike: false,
    underline: false,
    color: '#0a0a0a',
    font: {
      name: 'Arial',
      size: 10,
      bold: false,
      italic: false,
    },
  },
};

function rangeReduceIf(min, max, inits, initv, ifv, getv) {
  let s = inits;
  let v = initv;
  let i = min;
  for (; i < max; i += 1) {
    if (s > ifv) break;
    v = getv(i);
    s += v;
  }
  return [i, s - v, v];
}

export default class DataProxy {
  constructor(name, settings = {}) {
    this.settings = _.merge(defaultSettings, settings);
    // save data begin
    this.name = name || 'sheet';
    this.freeze = [0, 0];
    this.styles = []; // Array<Style>
    this.merges = new Merges(); // [CellRange, ...]
    this.rows = new Rows(this.settings.row);
    this.cols = new Cols(this.settings.col);

    this.hyperlinks = {};
    this.comments = {};
    // save data end

    // don't save object
    this.selector = new Selector();
    this.scroll = new Scroll();
    // this.history = new History();
    // this.clipboard = new Clipboard();
    this.autoFilter = new AutoFilter();
    // this.change = () => {};
    this.exceptRowSet = new Set();
    this.sortedRowMap = new Map();
    this.unsortedRowMap = new Map();
  }

  /**
   * 根据传入滚动条滚动值设置开始单元格和滚动值
   * @param {Number} x 横向滚动条滚动值
   * @param {Number} callback 回调
   */
  scrollx(x, callback) {
    const { scroll, freeze, cols } = this;
    const [, fci] = freeze;

    const [colIndex] = rangeReduceIf(fci, cols.len, 0, 0, x, index =>
      cols.getWidth(index),
    );

    // 渲染函数使用 colIndex 值作为开始单元格，当前一个格子因为隐藏不可见时，赋值 CI
    scroll.colIndex = x > 0 ? colIndex - 1 : 0;
    scroll.x = x;
    callback();
  }

  /**
   * 根据传入滚动条滚动值设置开始单元格和滚动值
   * @param {Number} y 纵向滚动条滚动值
   * @param {Number} callback 回调
   */
  scrolly(y, callback) {
    const { scroll, freeze, rows } = this;
    const [fri] = freeze;
    const [rowIndex] = rangeReduceIf(fri, rows.len, 0, 0, y, index =>
      rows.getHeight(index),
    );

    // 渲染函数使用 rowIndex 值作为开始单元格，当前一个格子因为隐藏不可见时，赋值 CI
    scroll.rowIndex = y > 0 ? rowIndex - 1 : 0;
    scroll.y = y;
    return callback();
  }

  /**
   * 获取文档视图高度
   * @return {Number} 返回设置中的高度
   */
  viewHeight() {
    return this.settings.view.height();
  }

  /**
   * 获取文档视图宽度
   * @return {Number} 返回设置中的宽度
   */
  viewWidth() {
    return this.settings.view.width();
  }

  /**
   * 设置表格数据
   * @param {Object} data 表格数据
   */
  setData(data) {
    _.forIn(data, (value, property) => {
      if (property === 'merges' || property === 'rows' || property === 'cols') {
        this[property].setData(data[property]);
      } else if (property === 'freeze') {
        const [x, y] = expr2xy(data[property]);
        this.freeze = [y, x];
      } else if (data[property] !== undefined) {
        this[property] = data[property];
      }
    });

    return this;
  }

  eachMergesInView(viewRange, callback) {
    // console.log(444, this.merges.filterIntersects(viewRange));
    this.merges.filterIntersects(viewRange).forEach(it => callback(it));
  }

  rowEach(min, max, callback) {
    let y = 0;
    const { rows } = this;
    const frset = this.exceptRowSet;
    const frary = [...frset];
    let offset = 0;
    for (let i = 0; i < frary.length; i += 1) {
      if (frary[i] < min) {
        offset += 1;
      }
    }
    // console.log('min:', min, ', max:', max, ', scroll:', scroll);
    for (let i = min + offset; i <= max + offset; i += 1) {
      if (frset.has(i)) {
        offset += 1;
      } else {
        const rowHeight = rows.getHeight(i);
        callback(i, y, rowHeight);
        y += rowHeight;
        if (y > this.viewHeight()) break;
      }
    }
  }

  colEach(min, max, callback) {
    let x = 0;
    const { cols } = this;
    for (let i = min; i <= max; i += 1) {
      const colWidth = cols.getWidth(i);
      callback(i, x, colWidth);
      x += colWidth;
      if (x > this.viewWidth()) break;
    }
  }

  exceptRowTotalHeight(sri, eri) {
    const { exceptRowSet, rows } = this;
    const exceptRows = Array.from(exceptRowSet);
    let exceptRowTH = 0;
    exceptRows.forEach(rowIndex => {
      if (rowIndex < sri || rowIndex > eri) {
        const height = rows.getHeight(rowIndex);
        exceptRowTH += height;
      }
    });
    return exceptRowTH;
  }

  viewRange() {
    const { scroll, rows, cols, freeze, exceptRowSet } = this;
    let { rowIndex, colIndex } = scroll;
    if (rowIndex <= 0) [rowIndex] = freeze;
    if (colIndex <= 0) [, colIndex] = freeze;

    let [x, y] = [0, 0];
    let [eri, eci] = [rows.len, cols.len];

    for (let i = rowIndex; i < rows.len; i += 1) {
      if (!exceptRowSet.has(i)) {
        y += rows.getHeight(i);
        eri = i;
      }
      if (y > this.viewHeight()) break;
    }

    for (let j = colIndex; j < cols.len; j += 1) {
      x += cols.getWidth(j);
      eci = j;
      if (x > this.viewWidth()) break;
    }

    return new CellRange(rowIndex, colIndex, eri, eci, x, y);
  }

  cellRect(rowIndex, colIndex) {
    const { rows, cols } = this;
    const left = cols.sumWidth(0, colIndex);
    const top = rows.sumHeight(0, rowIndex);
    const cell = rows.getCell(rowIndex, colIndex);
    let width = cols.getWidth(colIndex);
    let height = rows.getHeight(rowIndex);

    if (cell !== null) {
      if (cell.merge) {
        const [rn, cn] = cell.merge;

        if (rn > 0) {
          for (let i = 1; i <= rn; i += 1) {
            height += rows.getHeight(rowIndex + i);
          }
        }
        if (cn > 0) {
          for (let i = 1; i <= cn; i += 1) {
            width += cols.getWidth(colIndex + i);
          }
        }
      }
    }

    return {
      left,
      top,
      width,
      height,
      cell,
    };
  }

  getCell(rowIndex, colIndex) {
    return this.rows.getCell(rowIndex, colIndex);
  }

  // 获取默认样式
  defaultStyle() {
    return this.settings.style;
  }

  getCellStyleOrDefault(rowIndex, colIndex) {
    const { styles, rows } = this;
    const cell = rows.getCell(rowIndex, colIndex);
    const cellStyle =
      cell && cell.style !== undefined ? styles[cell.style] : {};
    return _.merge({}, this.defaultStyle(), cellStyle);
  }

  freezeTotalWidth() {
    return this.cols.sumWidth(0, this.freeze[1]);
  }

  freezeTotalHeight() {
    return this.rows.sumHeight(0, this.freeze[0]);
  }
}
