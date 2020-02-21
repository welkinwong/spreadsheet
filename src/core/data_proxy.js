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

/**
 * 根据Y坐标获取单元格所在行
 * @param {Number} y Y坐标
 * @param {Number} scrollOffsety
 */
function getCellRowByY(y, scrollOffsety) {
  const { rows, fixedHeaderHeight } = this;
  const fsh = this.freezeTotalHeight();
  // console.log('y:', y, ', fsh:', fsh);
  let inits = rows.height;
  if (fsh + rows.height < y) inits -= scrollOffsety;

  // handle rowIndex in autofilter
  const frset = this.exceptRowSet;

  let rowIndex = 0;
  let top = inits;
  let { height } = rows;
  for (; rowIndex < rows.len; rowIndex += 1) {
    if (top > y) break;
    if (!frset.has(rowIndex)) {
      height = rows.getHeight(rowIndex);
      top += height;
    }
  }
  top -= height;

  if (top <= 0) {
    return { rowIndex: -1, top: 0, height };
  }

  return { rowIndex: rowIndex - 1, top, height };
}

/**
 * 根据X坐标获取单元格所在列
 * @param {Number} x X坐标
 * @param {Number} scrollOffsetx
 */
function getCellColByX(x, scrollOffsetx) {
  const { cols, fixedHeaderWidth } = this;
  const fsw = this.freezeTotalWidth();
  let inits = cols.indexWidth;
  if (fsw + cols.indexWidth < x) inits -= scrollOffsetx;
  const [colIndex, left, width] = rangeReduceIf(
    0,
    cols.len,
    inits,
    cols.indexWidth,
    x,
    i => cols.getWidth(i),
  );
  if (left <= 0) {
    return { colIndex: -1, left: 0, width: cols.indexWidth };
  }
  return { colIndex: colIndex - 1, left, width: width - fixedHeaderWidth };
}

export default class DataProxy {
  constructor(name, settings = {}) {
    this.settings = _.merge(defaultSettings, settings);
    // 顶部和左边标签栏宽高
    this.fixedHeaderWidth = 30;
    this.fixedHeaderHeight = 25;
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
    this.change = () => {};
    this.exceptRowSet = new Set();
    this.sortedRowMap = new Map();
    this.unsortedRowMap = new Map();
  }

  calSelectedRangeByEnd(rowIndex, colIndex) {
    const { selector, rows, cols, merges } = this;
    let { sri, sci, eri, eci } = selector.range;
    const cri = selector.rowIndex;
    const cci = selector.colIndex;
    let [nri, nci] = [rowIndex, colIndex];
    if (rowIndex < 0) nri = rows.len - 1;
    if (colIndex < 0) nci = cols.len - 1;
    if (nri > cri) [sri, eri] = [cri, nri];
    else [sri, eri] = [nri, cri];
    if (nci > cci) [sci, eci] = [cci, nci];
    else [sci, eci] = [nci, cci];
    selector.range = merges.union(new CellRange(sri, sci, eri, eci));
    selector.range = merges.union(selector.range);
    // console.log('selector.range:', selector.range);
    return selector.range;
  }

  calSelectedRangeByStart(rowIndex, colIndex) {
    const { selector, rows, cols, merges } = this;
    let cellRange = merges.getFirstIncludes(rowIndex, colIndex);
    // console.log('cellRange:', cellRange, rowIndex, colIndex, merges);
    if (cellRange === null) {
      cellRange = new CellRange(rowIndex, colIndex, rowIndex, colIndex);
      if (rowIndex === -1) {
        cellRange.sri = 0;
        cellRange.eri = rows.len - 1;
      }
      if (colIndex === -1) {
        cellRange.sci = 0;
        cellRange.eci = cols.len - 1;
      }
    }
    selector.range = cellRange;
    return cellRange;
  }

  // state: input | finished
  setSelectedCellText(text, state = 'input') {
    const { autoFilter, selector, rows } = this;
    const { rowIndex, colIndex } = selector;
    let nri = rowIndex;
    if (this.unsortedRowMap.has(rowIndex)) {
      nri = this.unsortedRowMap.get(rowIndex);
    }
    const oldCell = rows.getCell(nri, colIndex);
    const oldText = oldCell ? oldCell.text : '';
    this.setCellText(nri, colIndex, text, state);
    // replace filter.value
    if (autoFilter.active()) {
      const filter = autoFilter.getFilter(colIndex);
      if (filter) {
        const vIndex = filter.value.findIndex(v => v === oldText);
        if (vIndex >= 0) {
          filter.value.splice(vIndex, 1, text);
        }
        // console.log('filter:', filter, oldCell);
      }
    }
    // this.resetAutoFilter();
  }

  getSelectedCell() {
    const { rowIndex, colIndex } = this.selector;
    let nri = rowIndex;
    if (this.unsortedRowMap.has(rowIndex)) {
      nri = this.unsortedRowMap.get(rowIndex);
    }
    return this.rows.getCell(nri, colIndex);
  }

  getSelectedRect() {
    return this.getRect(this.selector.range);
  }

  // getClipboardRect() {
  //   const { clipboard } = this;
  //   if (!clipboard.isClear()) {
  //     return this.getRect(clipboard.range);
  //   }
  //   return { left: -100, top: -100 };
  // }

  getRect(cellRange) {
    const { scroll, rows, cols, exceptRowSet } = this;
    const { sri, sci, eri, eci } = cellRange;
    // console.log('sri:', sri, ',sci:', sci, ', eri:', eri, ', eci:', eci);
    // no selector
    if (sri < 0 && sci < 0) {
      return {
        left: 0,
        l: 0,
        top: 0,
        t: 0,
        scroll,
      };
    }
    const left = cols.sumWidth(0, sci);
    const top = rows.sumHeight(0, sri, exceptRowSet);
    const height = rows.sumHeight(sri, eri + 1, exceptRowSet);
    const width = cols.sumWidth(sci, eci + 1);
    // console.log('sri:', sri, ', sci:', sci, ', eri:', eri, ', eci:', eci);
    let left0 = left - scroll.x;
    let top0 = top - scroll.y;
    const fsh = this.freezeTotalHeight();
    const fsw = this.freezeTotalWidth();
    if (fsw > 0 && fsw > left) {
      left0 = left;
    }
    if (fsh > 0 && fsh > top) {
      top0 = top;
    }
    return {
      l: left,
      t: top,
      left: left0,
      top: top0,
      height,
      width,
      scroll,
    };
  }

  /**
   * 根据坐标获取单元格
   * @param {Number} x X坐标
   * @param {Number} y Y坐标
   */
  getCellRectByXY(x, y) {
    const { scroll, merges, rows, cols } = this;
    let { rowIndex, top, height } = getCellRowByY.call(this, y, scroll.y);
    let { colIndex, left, width } = getCellColByX.call(this, x, scroll.x);
    if (colIndex === -1) {
      width = cols.totalWidth();
    }
    if (rowIndex === -1) {
      height = rows.totalHeight();
    }
    if (rowIndex >= 0 || colIndex >= 0) {
      const merge = merges.getFirstIncludes(rowIndex, colIndex);
      if (merge) {
        rowIndex = merge.sri;
        colIndex = merge.sci;
        ({ left, top, width, height } = this.cellRect(rowIndex, colIndex));
      }
    }
    return {
      rowIndex,
      colIndex,
      left,
      top,
      width,
      height,
    };
  }

  /**
   * 根据传入滚动条滚动值设置开始单元格和滚动值
   * @param {Number} x 横向滚动条滚动值
   * @param {Number} callback 回调
   */
  scrollx(x, callback) {
    const { scroll, freeze, cols } = this;
    const [, freezeColIndex] = freeze;

    const [colIndex] = rangeReduceIf(freezeColIndex, cols.len, 0, 0, x, index =>
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
    const [freezeRowIndex] = freeze;
    const [rowIndex] = rangeReduceIf(freezeRowIndex, rows.len, 0, 0, y, index =>
      rows.getHeight(index),
    );

    // 渲染函数使用 rowIndex 值作为开始单元格，当前一个格子因为隐藏不可见时，赋值 CI
    scroll.rowIndex = y > 0 ? rowIndex - 1 : 0;
    scroll.y = y;
    return callback();
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
        // console.log('cell.merge:', cell.merge);
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
    // console.log('data:', this.d);
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

  getCellTextOrDefault(rowIndex, colIndex) {
    console.log(this);
    const cell = this.getCell(rowIndex, colIndex);
    return cell && cell.text ? cell.text : '';
  }

  getCellStyle(rowIndex, colIndex) {
    const cell = this.getCell(rowIndex, colIndex);
    if (cell && cell.style !== undefined) {
      return this.styles[cell.style];
    }
    return null;
  }

  getCellStyleOrDefault(rowIndex, colIndex) {
    const { styles, rows } = this;
    const cell = rows.getCell(rowIndex, colIndex);
    const cellStyle =
      cell && cell.style !== undefined ? styles[cell.style] : {};
    return _.merge({}, this.defaultStyle(), cellStyle);
  }

  getSelectedCellStyle() {
    const { rowIndex, colIndex } = this.selector;
    return this.getCellStyleOrDefault(rowIndex, colIndex);
  }

  /**
   * 设置单元格文本
   * @param {Number} rowIndex 行开始下标
   * @param {Number} colIndex 列开始下标
   * @param {String} text 文本
   * @param {String} state 状态 input | finished
   * @param {String} source 触发源
   */
  setCellText(rowIndex, colIndex, text, state, source = 'editor') {
    // const { rows, history, validations } = this;
    const { rows } = this;
    if (state === 'finished') {
      rows.setCellText(rowIndex, colIndex, '');
      // history.add(this.getData());
      rows.setCellText(rowIndex, colIndex, text);
    } else {
      const oldText = this.getCellTextOrDefault(rowIndex, colIndex);
      rows.setCellText(rowIndex, colIndex, text);

      const delta = [
        {
          p: ['rows', rowIndex, 'cells', colIndex, 'text'],
          od: oldText,
          oi: text,
        },
      ];

      this.changeData(delta, source);
    }
    // validator
    // validations.validate(rowIndex, colIndex, text);
  }

  /**
   * 设置行高度
   * @param {Number} rowIndex 行开始下标
   * @param {Number} height 宽度
   * @param {String} source 触发源
   */
  setRowHeight(rowIndex, newHeight, source = 'editor') {
    const oldRowHeight = this.rows.getHeight(rowIndex);
    this.rows.setHeight(rowIndex, newHeight);

    const delta = [
      {
        p: ['rows', rowIndex, 'height'],
        od: oldRowHeight,
        oi: newHeight,
      },
    ];

    this.changeData(delta, source);
  }

  /**
   * 设置列宽度
   * @param {Number} colIndex 列开始下标
   * @param {Number} width 宽度
   * @param {String} source 触发源
   */
  setColWidth(colIndex, width, source = 'editor') {
    const oldColWidth = this.cols.getWidth(colIndex);
    this.cols.setWidth(colIndex, width);

    const delta = [
      {
        p: ['cols', colIndex, 'width'],
        od: oldColWidth,
        oi: width,
      },
    ];

    this.changeData(delta, source);
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

  freezeViewRange() {
    const [rowIndex, colIndex] = this.freeze;
    return new CellRange(
      0,
      0,
      rowIndex - 1,
      colIndex - 1,
      this.freezeTotalWidth(),
      this.freezeTotalHeight(),
    );
  }

  changeData(delta, source) {
    // 原作者该处写入历史记录
    this.change(delta, source);
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

  update(ops) {
    const source = 'api';

    _.each(ops, op => {
      switch (op.p[0]) {
        case 'rows':
          if (op.p[2] === 'height') this.setRowHeight(op.p[1], op.oi, source);
          if (op.p[4] === 'text')
            this.setCellText(op.p[1], op.p[3], op.oi, source);
          break;
        case 'cols':
          if (op.p[2] === 'width') this.setColWidth(op.p[1], op.oi, source);
      }
    });
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

  freezeTotalWidth() {
    return this.cols.sumWidth(0, this.freeze[1]);
  }

  freezeTotalHeight() {
    return this.rows.sumHeight(0, this.freeze[0]);
  }
}
