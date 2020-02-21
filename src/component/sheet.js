import { h } from '../lib/element';
import { bind, mouseMoveUp, bindTouch } from '../lib/event';
import Table from './table';
import Resizer from './resizer';
import Scrollbar from './scrollbar';
import Selector from './selector';
import Editor from './editor';

// 滚动条滚动
function scrollbarMove() {
  const { data, verticalScrollbar, horizontalScrollbar } = this;
  const { l, t, left, top, width, height } = data.getSelectedRect();
  const tableOffset = this.getTableOffset();
  // console.log(',l:', l, ', left:', left, ', tOffset.left:', tableOffset.width);
  if (Math.abs(left) + width > tableOffset.width) {
    horizontalScrollbar.move({ left: l + width - tableOffset.width });
  } else {
    const fsw = data.freezeTotalWidth();
    if (left < fsw) {
      horizontalScrollbar.move({ left: l - 1 - fsw });
    }
  }
  // console.log('top:', top, ', height:', height, ', tof.height:', tableOffset.height);
  if (Math.abs(top) + height > tableOffset.height) {
    verticalScrollbar.move({ top: t + height - tableOffset.height - 1 });
  } else {
    const fsh = data.freezeTotalHeight();
    if (top < fsh) {
      verticalScrollbar.move({ top: t - 1 - fsh });
    }
  }
}

// 设置选区
function selectorSet(
  multiple,
  rowIndex,
  colIndex,
  indexesUpdated = true,
  moving = false,
) {
  if (rowIndex === -1 && colIndex === -1) return;
  // console.log(multiple, ', rowIndex:', rowIndex, ', colIndex:', colIndex);
  const { table, selector } = this;
  if (multiple) {
    selector.setEnd(rowIndex, colIndex, moving);
  } else {
    selector.set(rowIndex, colIndex, indexesUpdated);
  }
  table.render();
}

// multiple: boolean
// direction: left | right | up | down | row-first | row-last | col-first | col-last
function selectorMove(multiple, direction) {
  const { selector, data } = this;
  const { rows, cols } = data;
  let [rowIndex, colIndex] = selector.indexes;
  const { eri, eci } = selector.range;
  if (multiple) {
    [rowIndex, colIndex] = selector.moveIndexes;
  }
  // console.log('selector.move:', rowIndex, colIndex);
  if (direction === 'left') {
    if (colIndex > 0) colIndex -= 1;
  } else if (direction === 'right') {
    if (eci !== colIndex) colIndex = eci;
    if (colIndex < cols.len - 1) colIndex += 1;
  } else if (direction === 'up') {
    if (rowIndex > 0) rowIndex -= 1;
  } else if (direction === 'down') {
    if (eri !== rowIndex) rowIndex = eri;
    if (rowIndex < rows.len - 1) rowIndex += 1;
  } else if (direction === 'row-first') {
    colIndex = 0;
  } else if (direction === 'row-last') {
    colIndex = cols.len - 1;
  } else if (direction === 'col-first') {
    rowIndex = 0;
  } else if (direction === 'col-last') {
    rowIndex = rows.len - 1;
  }
  if (multiple) {
    selector.moveIndexes = [rowIndex, colIndex];
  }
  selectorSet.call(this, multiple, rowIndex, colIndex);
  scrollbarMove.call(this);
}

/**
 *  覆盖层鼠标移动
 * @param {Object} event
 */
function overlayerMousemove(event) {
  // console.log('x:', event.offsetX, ', y:', event.offsetY);
  if (event.buttons !== 0) return;
  if (event.target.className === 'spreadsheet-resizer-hover') return;

  const { offsetX, offsetY } = event;
  const { rowResizer, colResizer, tableEl, data } = this;
  const { rows, cols, fixedHeaderWidth } = data;

  if (offsetX > cols.indexWidth && offsetY > rows.height) {
    rowResizer.hide();
    colResizer.hide();
    return;
  }

  const tRect = tableEl.box();
  const cRect = data.getCellRectByXY(event.offsetX, event.offsetY);

  if (cRect.rowIndex >= 0 && cRect.colIndex === -1) {
    cRect.width = fixedHeaderWidth;
    rowResizer.show(cRect, {
      width: tRect.width,
    });
  } else {
    rowResizer.hide();
  }
  if (cRect.rowIndex === -1 && cRect.colIndex >= 0) {
    cRect.height = rows.height;
    colResizer.show(cRect, {
      height: tRect.height,
    });
  } else {
    colResizer.hide();
  }
}

/**
 * 遮罩层鼠标鼠标滚动转换为表格滚动
 * @param {Object} event 鼠标事件
 */
function overlayerMousescroll(event) {
  const { verticalScrollbar, horizontalScrollbar } = this;
  const { top } = verticalScrollbar.scroll();
  const { left } = horizontalScrollbar.scroll();
  const { deltaY, deltaX } = event;

  // deltaY for vertical delta
  verticalScrollbar.move({
    top: top + deltaY,
  });

  // deltaX for Mac horizontal scroll
  horizontalScrollbar.move({
    left: left + deltaX,
  });
}

/**
 * 设置纵向滚动条
 */
function verticalScrollbarSet() {
  const { data, verticalScrollbar } = this;
  const { height } = this.getTableOffset();
  const erth = data.exceptRowTotalHeight(0, -1);
  verticalScrollbar.set(height, data.rows.totalHeight() - erth);
}

/**
 * 设置横向滚动条
 */
function horizontalScrollbarSet() {
  const { data, horizontalScrollbar } = this;
  const { width } = this.getTableOffset();
  if (data) {
    horizontalScrollbar.set(width, data.cols.totalWidth());
  }
}

function sheetFreeze() {
  const { selector, data, editor } = this;
  const [rowIndex, colIndex] = data.freeze;
  if (rowIndex > 0 || colIndex > 0) {
    const fwidth = data.freezeTotalWidth();
    const fheight = data.freezeTotalHeight();
    editor.setFreezeLengths(fwidth, fheight);
  }
  selector.resetAreaOffset();
}

/**
 * 重置 Sheet
 */
function sheetReset() {
  const { tableEl, table, overlayerEl, overlayerCEl, el } = this;
  const tOffset = this.getTableOffset();
  const vRect = this.getRect();
  tableEl.attr(vRect);
  overlayerEl.offset(vRect); // 重置遮罩层外层
  overlayerCEl.offset(tOffset); // 重置遮罩层内层
  el.css('width', `${vRect.width}px`);
  verticalScrollbarSet.call(this); // 设置纵向滚动条
  horizontalScrollbarSet.call(this); // 设置横向滚动条
  sheetFreeze.call(this); // 设置固定行列
  table.render(); // 渲染表格
}

function overlayerMousedown(evt) {
  // console.log(':::::overlayer.mousedown:', evt.detail, evt.button, evt.buttons, evt.shiftKey);
  // console.log('evt.target.className:', evt.target.className);
  const { selector, data, table, sortFilter } = this;
  const { offsetX, offsetY } = evt;
  const isAutofillEl = evt.target.className === 'spreadsheet-selector-corner';
  const cellRect = data.getCellRectByXY(offsetX, offsetY);
  const { left, top, width, height } = cellRect;
  let { rowIndex, colIndex } = cellRect;
  // sort or filter
  const { autoFilter } = data;
  if (autoFilter.includes(rowIndex, colIndex)) {
    if (left + width - 20 < offsetX && top + height - 20 < offsetY) {
      const items = autoFilter.items(colIndex, (r, c) =>
        data.rows.getCell(r, c),
      );
      sortFilter.set(
        colIndex,
        items,
        autoFilter.getFilter(colIndex),
        autoFilter.getSort(colIndex),
      );
      sortFilter.setOffset({ left, top: top + height + 2 });
      return;
    }
  }

  // console.log('rowIndex:', rowIndex, ', colIndex:', colIndex);
  if (!evt.shiftKey) {
    // console.log('selectorSetStart:::');
    if (isAutofillEl) {
      selector.showAutofill(rowIndex, colIndex);
    } else {
      selectorSet.call(this, false, rowIndex, colIndex);
    }

    // mouse move up
    mouseMoveUp(
      window,
      e => {
        // console.log('mouseMoveUp::::');
        ({ rowIndex, colIndex } = data.getCellRectByXY(e.offsetX, e.offsetY));
        if (isAutofillEl) {
          selector.showAutofill(rowIndex, colIndex);
        } else if (e.buttons === 1 && !e.shiftKey) {
          selectorSet.call(this, true, rowIndex, colIndex, true, true);
        }
      },
      () => {
        if (isAutofillEl) {
          if (
            data.autofill(selector.arange, 'all', msg => xtoast('Tip', msg))
          ) {
            table.render();
          }
        }
        selector.hideAutofill();
      },
    );
  }

  if (!isAutofillEl && evt.buttons === 1) {
    if (evt.shiftKey) {
      // console.log('shiftKey::::');
      selectorSet.call(this, true, rowIndex, colIndex);
    }
  }
}

function editorSetOffset() {
  const { editor, data } = this;
  const sOffset = data.getSelectedRect();
  const tOffset = this.getTableOffset();
  let sPosition = 'top';

  if (sOffset.top > tOffset.height / 2) {
    sPosition = 'bottom';
  }

  editor.setOffset(sOffset, sPosition);
}

function editorSet() {
  const { editor, data } = this;
  editorSetOffset.call(this);
  // editor.setCell(data.getSelectedCell(), data.getSelectedValidator());
  editor.setCell(data.getSelectedCell());
  // clearClipboard.call(this);
}

/**
 * 纵向滚动条滚动
 * @param {*} distance
 */
function verticalScrollbarMove(distance) {
  const { data, table, selector } = this;
  data.scrolly(distance, () => {
    selector.resetBRLAreaOffset();
    editorSetOffset.call(this);
    table.render();
  });
}

/**
 * 横向滚动条滚动
 * @param {*} distance
 */
function horizontalScrollbarMove(distance) {
  const { data, table, selector } = this;
  data.scrollx(distance, () => {
    selector.resetBRTAreaOffset();
    editorSetOffset.call(this);
    table.render();
  });
}

/**
 * 行更改高度完成
 * @param {Object} cRect
 * @param {Number} distance
 */
function rowResizerFinished(cRect, distance) {
  const { rowIndex } = cRect;
  const { table, selector, data } = this;

  data.setRowHeight(rowIndex, distance, 'user');

  table.render();
  selector.resetAreaOffset();
  verticalScrollbarSet.call(this);
  editorSetOffset.call(this);
}

/**
 * 列更改宽度完成
 * @param {Object} cRect
 * @param {Number} distance
 */
function colResizerFinished(cRect, distance) {
  const { colIndex } = cRect;
  const { table, selector, data } = this;
  const { fixedHeaderWidth } = data;

  data.setColWidth(colIndex, distance + fixedHeaderWidth, 'user');

  // console.log('data:', data);
  table.render();
  selector.resetAreaOffset();
  horizontalScrollbarSet.call(this);
  editorSetOffset.call(this);
}

function dataSetCellText(text, state = 'finished') {
  const { data, table } = this;
  // const [rowIndex, colIndex] = selector.indexes;
  data.setSelectedCellText(text, state);
  if (state === 'finished') table.render();
}

// 初始化事件
function sheetInitEvents() {
  const {
    overlayerEl,
    rowResizer,
    colResizer,
    verticalScrollbar,
    horizontalScrollbar,
    editor,
  } = this;

  // overlayer
  overlayerEl
    .on('mousemove', event => {
      overlayerMousemove.call(this, event);
    })
    .on('mousedown', event => {
      // the left mouse button: mousedown → mouseup → click
      // the right mouse button: mousedown → contenxtmenu → mouseup
      if (event.buttons === 2) {
        if (data.xyInSelectedRect(event.offsetX, event.offsetY)) {
          contextMenu.setPosition(event.offsetX, event.offsetY);
          event.stopPropagation();
        } else {
          contextMenu.hide();
        }
      } else if (event.detail === 2) {
        editorSet.call(this);
      } else {
        editor.clear();
        overlayerMousedown.call(this, event);
      }
    })
    .on('mousewheel.stop', event => {
      overlayerMousescroll.call(this, event);
    })
    .on('mouseout', event => {
      const { offsetX, offsetY } = event;
      if (offsetY <= 0) colResizer.hide();
      if (offsetX <= 0) rowResizer.hide();
    });

  // resizer finished callback
  rowResizer.finishedFn = (cRect, distance) => {
    rowResizerFinished.call(this, cRect, distance);
  };
  colResizer.finishedFn = (cRect, distance) => {
    colResizerFinished.call(this, cRect, distance);
  };

  verticalScrollbar.moveFn = (distance, event) => {
    verticalScrollbarMove.call(this, distance, event);
  };

  horizontalScrollbar.moveFn = (distance, event) => {
    horizontalScrollbarMove.call(this, distance, event);
  };

  // editor
  editor.change = (state, itext) => {
    dataSetCellText.call(this, itext, state);
  };

  bind(window, 'resize', () => {
    this.reload();
  });

  bind(window, 'click', evt => {
    this.focusing = overlayerEl.contains(evt.target);
  });

  // for selector
  bind(window, 'keydown', evt => {
    if (!this.focusing) return;
    const keyCode = evt.keyCode || evt.which;
    const { key, ctrlKey, shiftKey, altKey, metaKey } = evt;
    // console.log('keydown.evt: ', keyCode);
    if (ctrlKey || metaKey) {
      // const { sIndexes, eIndexes } = selector;
      let what = 'all';
      if (shiftKey) what = 'text';
      if (altKey) what = 'format';
      switch (keyCode) {
        case 90:
          // undo: ctrl + z
          this.undo();
          evt.preventDefault();
          break;
        case 89:
          // redo: ctrl + y
          this.redo();
          evt.preventDefault();
          break;
        case 67:
          // ctrl + c
          copy.call(this);
          evt.preventDefault();
          break;
        case 88:
          // ctrl + x
          cut.call(this);
          evt.preventDefault();
          break;
        case 85:
          // ctrl + u
          toolbar.trigger('underline');
          evt.preventDefault();
          break;
        case 86:
          // ctrl + v
          paste.call(this, what);
          // evt.preventDefault();
          break;
        case 37:
          // ctrl + left
          selectorMove.call(this, shiftKey, 'row-first');
          evt.preventDefault();
          break;
        case 38:
          // ctrl + up
          selectorMove.call(this, shiftKey, 'col-first');
          evt.preventDefault();
          break;
        case 39:
          // ctrl + right
          selectorMove.call(this, shiftKey, 'row-last');
          evt.preventDefault();
          break;
        case 40:
          // ctrl + down
          selectorMove.call(this, shiftKey, 'col-last');
          evt.preventDefault();
          break;
        case 32:
          // ctrl + space, all cells in col
          selectorSet.call(this, false, -1, data.selector.colIndex, false);
          evt.preventDefault();
          break;
        case 66:
          // ctrl + B
          toolbar.trigger('bold');
          break;
        case 73:
          // ctrl + I
          toolbar.trigger('italic');
          break;
        default:
          break;
      }
    } else {
      // console.log('evt.keyCode:', evt.keyCode);
      switch (keyCode) {
        case 32:
          if (shiftKey) {
            // shift + space, all cells in row
            selectorSet.call(this, false, data.selector.rowIndex, -1, false);
          }
          break;
        case 27: // esc
          contextMenu.hide();
          clearClipboard.call(this);
          break;
        case 37: // left
          selectorMove.call(this, shiftKey, 'left');
          evt.preventDefault();
          break;
        case 38: // up
          selectorMove.call(this, shiftKey, 'up');
          evt.preventDefault();
          break;
        case 39: // right
          selectorMove.call(this, shiftKey, 'right');
          evt.preventDefault();
          break;
        case 40: // down
          selectorMove.call(this, shiftKey, 'down');
          evt.preventDefault();
          break;
        case 9: // tab
          editor.clear();
          // shift + tab => move left
          // tab => move right
          selectorMove.call(this, false, shiftKey ? 'left' : 'right');
          evt.preventDefault();
          break;
        case 13: // enter
          if (altKey) {
            const c = data.getSelectedCell();
            const ntxt = c.text || '';
            dataSetCellText.call(this, `${ntxt}\n`, 'input');
            editorSet.call(this);
            break;
          }
          editor.clear();
          // shift + enter => move up
          // enter => move down
          selectorMove.call(this, false, shiftKey ? 'up' : 'down');
          evt.preventDefault();
          break;
        case 8: // backspace
          insertDeleteRowColumn.call(this, 'delete-cell-text');
          evt.preventDefault();
          break;
        default:
          break;
      }

      if (key === 'Delete') {
        insertDeleteRowColumn.call(this, 'delete-cell-text');
        evt.preventDefault();
      } else if (
        (keyCode >= 65 && keyCode <= 90) ||
        (keyCode >= 48 && keyCode <= 57) ||
        (keyCode >= 96 && keyCode <= 105) ||
        evt.key === '='
      ) {
        dataSetCellText.call(this, evt.key, 'input');
        editorSet.call(this);
      } else if (keyCode === 113) {
        // F2
        editorSet.call(this);
      }
    }
  });
}

// Sheet 主体
export default class Sheet {
  constructor(targetEl, data) {
    this.el = h('div', 'spreadsheet-sheet');
    targetEl.children(this.el);
    this.data = data;
    this.tableEl = h('canvas', 'spreadsheet-table');

    // resizer
    this.rowResizer = new Resizer(false, data.rows.height);
    this.colResizer = new Resizer(true, data.cols.minWidth);

    // 滚动条
    this.verticalScrollbar = new Scrollbar(true);
    this.horizontalScrollbar = new Scrollbar(false);

    // 编辑区
    // this.editor = new Editor(
    //   formulas,
    //   () => this.getTableOffset(),
    //   data.rows.height,
    // );
    this.editor = new Editor(
      null,
      () => this.getTableOffset(),
      data.rows.height,
    );

    this.selector = new Selector(data);
    this.overlayerCEl = h('div', 'spreadsheet-overlayer-content').children(
      this.editor.el,
      this.selector.el,
    );
    this.overlayerEl = h('div', 'spreadsheet-overlayer').child(
      this.overlayerCEl,
    );

    this.el.children(
      this.tableEl,
      this.overlayerEl.el,
      this.rowResizer.el,
      this.colResizer.el,
      this.verticalScrollbar.el,
      this.horizontalScrollbar.el,
    );

    this.table = new Table(this.tableEl.el, data);

    // 初始化事件
    sheetInitEvents.call(this);
    // 表格重置
    sheetReset.call(this);
  }

  loadData(data) {
    this.data.setData(data);
    sheetReset.call(this);
    return this;
  }

  reload() {
    sheetReset.call(this);
    return this;
  }

  getRect() {
    const { data } = this;
    return {
      width: data.viewWidth(),
      height: data.viewHeight(),
    };
  }

  getTableOffset() {
    const { fixedHeaderWidth, fixedHeaderHeight } = this.data;
    const { width, height } = this.getRect();
    return {
      width: width - fixedHeaderWidth + 15,
      height: height - fixedHeaderHeight,
      left: fixedHeaderWidth,
      top: fixedHeaderHeight,
    };
  }
}
