import { height } from '../lib/element';
import Table from './table';
import Resizer from './resizer';
import Scrollbar from './scrollbar';

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

function overlayerMousemove(event) {
  // console.log('x:', event.offsetX, ', y:', event.offsetY);
  if (event.buttons !== 0) return;
  if (event.target.className === `${cssPrefix}-resizer-hover`) return;
  const { offsetX, offsetY } = event;
  const { rowResizer, colResizer, tableEl, data } = this;
  const { rows, cols } = data;
  if (offsetX > cols.indexWidth && offsetY > rows.height) {
    rowResizer.hide();
    colResizer.hide();
    return;
  }
  const tRect = tableEl.box();
  const cRect = data.getCellRectByXY(event.offsetX, event.offsetY);
  if (cRect.rowIndex >= 0 && cRect.colIndex === -1) {
    cRect.width = cols.indexWidth;
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
  const { data } = this;
  // const { selector, data, editor } = this;
  const [ri, ci] = data.freeze;
  if (ri > 0 || ci > 0) {
    const fwidth = data.freezeTotalWidth();
    const fheight = data.freezeTotalHeight();
    // editor.setFreezeLengths(fwidth, fheight);
  }
  // selector.resetAreaOffset();
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
  // sheetFreeze.call(this); //
  table.render(); // 渲染表格
}

/**
 * 纵向滚动条滚动
 * @param {*} distance
 */
function verticalScrollbarMove(distance) {
  const { data, table, selector } = this;
  data.scrolly(distance, () => {
    // selector.resetBRLAreaOffset();
    // editorSetOffset.call(this);
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
    // selector.resetBRTAreaOffset();
    // editorSetOffset.call(this);
    table.render();
  });
}

// 初始化事件
function sheetInitEvents() {
  const {
    overlayerEl,
    rowResizer,
    colResizer,
    verticalScrollbar,
    horizontalScrollbar,
  } = this;

  window.addEventListener('resize', () => {
    this.reload();
  });

  // overlayer
  overlayerEl
    .on('mousemove', event => {
      // overlayerMousemove.call(this, event);
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
}

// Sheet 主体
export default class Sheet {
  constructor(targetEl, data) {
    this.el = height('div', 'spreadsheet-sheet');
    targetEl.children(this.el);
    this.data = data;
    this.tableEl = height('canvas', 'spreadsheet-table');

    // resizer
    this.rowResizer = new Resizer(false, data.rows.height);
    this.colResizer = new Resizer(true, data.cols.minWidth);

    // 滚动条
    this.verticalScrollbar = new Scrollbar(true);
    this.horizontalScrollbar = new Scrollbar(false);

    // this.selector = new Selector(data);
    this.overlayerCEl = height('div', 'spreadsheet-overlayer-content');
    this.overlayerEl = height('div', 'spreadsheet-overlayer').child(
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
    const { rows, cols } = this.data;
    const { width, height } = this.getRect();
    return {
      width: width - 30 + 15,
      height: height - 20,
      left: 30,
      top: 20,
    };
  }
}
