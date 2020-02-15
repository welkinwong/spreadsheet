import { stringAt } from '../core/alphabet';
import _cell from '../core/cell';
import { Draw, DrawBox, thinLineWidth, npx } from '../lib/draw';

// 单元格内边距
const cellPaddingWidth = 5;

const tableFixedHeaderCleanStyle = { fillStyle: '#f4f5f8' };
// 单网格样式
const tableGridStyle = {
  fillStyle: '#fff',
  lineWidth: thinLineWidth,
  strokeStyle: '#e6e6e6',
};

/**
 * 获取行列标签样式
 */
function tableFixedHeaderStyle() {
  return {
    textAlign: 'center',
    textBaseline: 'middle',
    font: `500 ${npx(12)}px Source Sans Pro`,
    fillStyle: '#585757',
    lineWidth: thinLineWidth(),
    strokeStyle: '#e6e6e6',
  };
}

function getDrawBox(rindex, cindex) {
  const { data } = this;
  const { left, top, width, height } = data.cellRect(rindex, cindex);
  return new DrawBox(left, top, width, height, cellPaddingWidth);
}

/**
 * 渲染单元格
 * @param {Number} rindex 行开始下标
 * @param {Number} cindex 列开始下标
 */
function renderCell(rindex, cindex) {
  const { draw, data } = this;
  const { sortedRowMap } = data;
  let nrindex = rindex;
  if (sortedRowMap.has(rindex)) {
    nrindex = sortedRowMap.get(rindex);
  }

  const cell = data.getCell(nrindex, cindex);
  if (cell === null) return;
  let frozen = false;
  if ('editable' in cell && cell.editable === false) {
    frozen = true;
  }

  const style = data.getCellStyleOrDefault(nrindex, cindex);
  // console.log('style:', style);
  const dbox = getDrawBox.call(this, rindex, cindex);
  dbox.bgcolor = style.bgcolor;
  if (style.border !== undefined) {
    dbox.setBorders(style.border);
    // bboxes.push({ rowIndex: rindex, colIndex: cindex, box: dbox });
    draw.strokeBorders(dbox);
  }

  draw.rect(dbox, () => {
    // render text
    let cellText = _cell.render(cell.text || '', null, (y, x) =>
      data.getCellTextOrDefault(x, y),
    );
    // if (style.format) {
    //   // console.log(data.formatm, '>>', cell.format);
    //   cellText = formatm[style.format].render(cellText);
    // }
    const font = style.font;
    // font.size = getFontSizePxByPt(font.size);
    // console.log('style:', style);
    draw.text(
      cellText,
      dbox,
      {
        align: style.align,
        valign: style.valign,
        font,
        color: style.color,
        strike: style.strike,
        underline: style.underline,
      },
      style.textwrap,
    );
    // error
    // const error = data.validations.getError(rindex, cindex);
    // if (error) {
    //   // console.log('error:', rindex, cindex, error);
    //   draw.error(dbox);
    // }
    // if (frozen) {
    //   draw.frozen(dbox);
    // }
  });
}

function renderAutofilter(viewRange) {
  const { data, draw } = this;
  if (viewRange) {
    const { autoFilter } = data;
    if (!autoFilter.active()) return;
    const afRange = autoFilter.hrange();
    if (viewRange.intersects(afRange)) {
      afRange.each((rowIndex, colIndex) => {
        const dbox = getDrawBox.call(this, rowIndex, colIndex);
        draw.dropdown(dbox);
      });
    }
  }
}

/**
 * 渲染内容
 * @param {Object} viewRange
 * @param {Number} fixedHeaderWidth 标签栏宽度
 * @param {Number} fixedHeaderHeight 标签栏高度
 * @param {Number} tx
 * @param {Number} ty
 */
function renderContent(viewRange, fixedHeaderWidth, fixedHeaderHeight, tx, ty) {
  const { draw, data } = this;
  draw.save();
  draw.translate(fixedHeaderWidth, fixedHeaderHeight).translate(tx, ty);

  const { exceptRowSet } = data;
  // const exceptRows = Array.from(exceptRowSet);
  const filteredTranslateFunc = rowIndex => {
    const ret = exceptRowSet.has(rowIndex);
    if (ret) {
      const height = data.rows.getHeight(rowIndex);
      draw.translate(0, -height);
    }
    return !ret;
  };

  const exceptRowTotalHeight = data.exceptRowTotalHeight(
    viewRange.sri,
    viewRange.eri,
  );
  // 渲染普通单元格
  draw.save();
  draw.translate(0, -exceptRowTotalHeight);
  viewRange.each(
    (rowIndex, colIndex) => {
      renderCell.call(this, rowIndex, colIndex);
    },
    rowIndex => filteredTranslateFunc(rowIndex),
  );
  draw.restore();

  // 渲染合并单元格
  const rset = new Set();
  draw.save();
  draw.translate(0, -exceptRowTotalHeight);
  data.eachMergesInView(viewRange, ({ sri, sci, eri }) => {
    if (!exceptRowSet.has(sri)) {
      renderCell.call(this, sri, sci);
    } else if (!rset.has(sri)) {
      rset.add(sri);
      const height = data.rows.sumHeight(sri, eri + 1);
      draw.translate(0, -height);
    }
  });
  draw.restore();

  // 3 render autofilter
  renderAutofilter.call(this, viewRange);

  draw.restore();
}

/**
 * 绘制行列标签栏背景
 * @param {Number} x X坐标
 * @param {Number} y Y坐标
 * @param {Number} width 宽度
 * @param {Number} height 高度
 */
function renderSelectedHeaderCell(x, y, width, height) {
  const { draw } = this;
  draw.save();
  draw
    .attr({ fillStyle: 'rgba(75, 137, 255, 0.08)' })
    .fillRect(x, y, width, height);
  draw.restore();
}

/**
 * 渲染行列标签栏
 * @param {String} type all | left | top
 * @param {Object} viewRange
 * @param {Number} w 标签栏宽度
 * @param {Number} h 标签栏高度
 * @param {Number} tx moving distance on x-axis
 * @param {Number} ty moving distance on y-axis
 */
function renderFixedHeaders(type, viewRange, w, h, tx, ty) {
  // console.log(type, viewRange, w, h, tx, ty);
  const { draw, data } = this;
  const { scroll, cols, rows } = data;
  const sumHeight = viewRange.h; // rows.sumHeight(viewRange.sri, viewRange.eri + 1);
  const sumWidth = viewRange.w; // cols.sumWidth(viewRange.sci, viewRange.eci + 1);
  const nty = ty + h;
  const ntx = tx + w;

  draw.save();
  // draw rect background
  draw.attr(tableFixedHeaderCleanStyle);
  if (type === 'all' || type === 'left') draw.fillRect(0, nty, w, sumHeight);
  if (type === 'all' || type === 'top') draw.fillRect(ntx, 0, sumWidth, h);

  const { sri, sci, eri, eci } = data.selector.range;
  // console.log(data.selectIndexes);
  // draw text
  // text font, align...
  draw.attr(tableFixedHeaderStyle());
  // 渲染左侧标签列
  if (type === 'all' || type === 'left') {
    data.rowEach(viewRange.sri, viewRange.eri, (i, y1, rowHeight) => {
      const y = nty + y1 - (scroll.y - rows.sumHeight(0, scroll.rowIndex));
      const ii = i;

      // 绘制分割线
      draw.line([0, y], [w, y]);

      // 绘制选中单元格对应的列背景
      if (sri <= ii && ii < eri + 1) {
        renderSelectedHeaderCell.call(this, 0, y, w, rowHeight);
      }

      // 绘制标签文字
      draw.fillText(ii + 1, w / 2, y + rowHeight / 2);
    });
    // 绘制标签单元格边框
    draw.line([0, sumHeight + nty], [w, sumHeight + nty]);
    draw.line([w, nty], [w, sumHeight + nty]);
  }
  // 渲染头部标签栏
  if (type === 'all' || type === 'top') {
    data.colEach(viewRange.sci, viewRange.eci, (i, x1, colWidth) => {
      const x = ntx + x1 - (scroll.x - cols.sumWidth(0, scroll.colIndex));
      const ii = i;

      // 绘制分割线
      draw.line([x, 0], [x, h]);

      // 绘制选中单元格对应的行背景
      if (sci <= ii && ii < eci + 1) {
        renderSelectedHeaderCell.call(this, x, 0, colWidth, h);
      }

      // 绘制标签文字
      draw.fillText(stringAt(ii), x + colWidth / 2, h / 2);
    });
    // 绘制标签单元格边框
    draw.line([sumWidth + ntx, 0], [sumWidth + ntx, h]);
    draw.line([0, h], [sumWidth + ntx, h]);
  }
  draw.restore();
}

/**
 * 渲染左上角空白单元格
 * @param {Number} fixedHeaderWidth 顶标签宽度
 * @param {Number} fixedHeaderHeight 左标签高度
 */
function renderFixedLeftTopCell(fixedHeaderWidth, fixedHeaderHeight) {
  const { draw } = this;
  draw.save();
  // left-top-cell
  draw
    .attr({ fillStyle: '#f4f5f8' })
    .fillRect(0, 0, fixedHeaderWidth, fixedHeaderHeight);
  draw.restore();
}

/**
 * 渲染内容网格
 * @param {Object} param0
 * @param {Number} fixedHeaderWidth 顶标签宽度
 * @param {Number} fixedHeaderHeight 左标签高度
 * @param {Number} tx
 * @param {Number} ty
 */
function renderContentGrid(
  { sri, sci, eri, eci, w, h },
  fixedHeaderWidth,
  fixedHeaderHeight,
  tx,
  ty,
) {
  const { draw, data } = this;
  const { settings, scroll, cols, rows } = data;

  draw.save();
  draw
    .attr(tableGridStyle)
    .translate(fixedHeaderWidth + tx, fixedHeaderHeight + ty);

  draw.clearRect(0, 0, w, h);
  if (!settings.showGrid) {
    draw.restore();
    return;
  }

  // 绘制行
  data.rowEach(sri, eri, (i, rowY, colHeight) => {
    const offsetY = scroll.y - rows.sumHeight(0, scroll.rowIndex); // 行偏移值
    if (i !== sri) draw.line([0, rowY - offsetY], [w, rowY - offsetY]);
    if (i === eri)
      draw.line(
        [0, rowY - offsetY + colHeight],
        [w, rowY - offsetY + colHeight],
      );
  });

  // 绘制列
  data.colEach(sci, eci, (i, colX, colWidth) => {
    const offsetX = scroll.x - cols.sumWidth(0, scroll.colIndex); // 列偏移值
    if (i !== sci) draw.line([colX - offsetX, 0], [colX - offsetX, h]);
    if (i === eci)
      draw.line([colX - offsetX + colWidth, 0], [colX - offsetX + colWidth, h]);
  });

  draw.restore();
}

/**
 * 表格类
 */
class Table {
  constructor(el, data) {
    this.el = el;
    this.draw = new Draw(el, data.viewWidth(), data.viewHeight());
    this.data = data;
  }

  /**
   * 渲染函数
   */
  render() {
    const { data } = this;
    // 顶部和左边标签栏宽高，修改时需同步修改 sheet.js 里的 getTableOffset
    const fixedHeaderWidth = 30;
    const fixedHeaderHeight = 20;

    this.draw.resize(data.viewWidth(), data.viewHeight());
    this.clear();

    const viewRange = data.viewRange();

    const tx = data.freezeTotalWidth();
    const ty = data.freezeTotalHeight();
    const { x, y } = data.scroll;
    renderContentGrid.call(
      this,
      viewRange,
      fixedHeaderWidth,
      fixedHeaderHeight,
      tx,
      ty,
    );
    renderContent.call(
      this,
      viewRange,
      fixedHeaderWidth,
      fixedHeaderHeight,
      -x,
      -y,
    );
    // console.log(viewRange);
    renderFixedHeaders.call(
      this,
      'all',
      viewRange,
      fixedHeaderWidth,
      fixedHeaderHeight,
      tx,
      ty,
    );
    renderFixedLeftTopCell.call(this, fixedHeaderWidth, fixedHeaderHeight);
  }

  clear() {
    this.draw.clear();
  }
}

export default Table;
