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
 * @param {Number} width 标签栏宽度
 * @param {Number} height 标签栏高度
 * @param {Number} tx moving distance on x-axis
 * @param {Number} ty moving distance on y-axis
 */
function renderFixedHeaders(type, viewRange, width, height, tx, ty, isFreeze) {
  const { draw, data } = this;
  const { scroll, cols, rows } = data;
  const sumHeight = viewRange.height; // rows.sumHeight(viewRange.sri, viewRange.eri + 1);
  const sumWidth = viewRange.width; // cols.sumWidth(viewRange.sci, viewRange.eci + 1);
  const nty = ty + height;
  const ntx = tx + width;

  draw.save();
  // draw rect background
  draw.attr(tableFixedHeaderCleanStyle);
  if (type === 'all' || type === 'left')
    draw.fillRect(0, nty, width, sumHeight);
  if (type === 'all' || type === 'top') draw.fillRect(ntx, 0, sumWidth, height);

  const { sri, sci, eri, eci } = data.selector.range;
  // console.log(data.selectIndexes);
  // draw text
  // text font, align...
  draw.attr(tableFixedHeaderStyle());
  // 渲染左侧标签列
  if (type === 'all' || type === 'left') {
    data.rowEach(viewRange.sri, viewRange.eri, (i, y1, rowHeight) => {
      const [freezeRowIndex] = data.freeze;
      let y = nty + y1;

      // 判断是否有设置固定行
      if (freezeRowIndex === 0) {
        // 如果没有固定行则按第 0 行开始计算偏移值
        y = y - (scroll.y - rows.sumHeight(0, scroll.rowIndex));
      } else if (
        i + 1 > freezeRowIndex &&
        freezeRowIndex > 0 &&
        scroll.rowIndex > 0
      ) {
        // 如果有固定列则按固定行开始计算偏移值
        y = y - (scroll.y - rows.sumHeight(freezeRowIndex, scroll.rowIndex));
      }

      const ii = i;

      // 绘制分割线
      draw.line([0, y], [width, y]);

      // 绘制选中单元格对应的列背景
      if (sri <= ii && ii < eri + 1) {
        renderSelectedHeaderCell.call(this, 0, y, width, rowHeight);
      }

      // 绘制标签文字
      draw.fillText(ii + 1, width / 2, y + rowHeight / 2);
    });
    // 绘制标签单元格边框
    draw.line([0, sumHeight + nty], [width, sumHeight + nty]);
    draw.line([width, nty], [width, sumHeight + nty]);
  }
  // 渲染头部标签栏
  if (type === 'all' || type === 'top') {
    data.colEach(viewRange.sci, viewRange.eci, (i, x1, colWidth) => {
      const [, freezeColIndex] = data.freeze;
      let x = ntx + x1;

      // 判断是否有设置固定列
      if (freezeColIndex === 0) {
        // 如果没有固定列则按第 0 列开始计算偏移值
        x = x - (scroll.x - cols.sumWidth(0, scroll.colIndex));
      } else if (
        i + 1 > freezeColIndex &&
        freezeColIndex > 0 &&
        scroll.colIndex > 0
      ) {
        // 如果有固定列则按固定列开始计算偏移值
        x = x - (scroll.x - cols.sumWidth(freezeColIndex, scroll.colIndex));
      }

      const ii = i;

      // 绘制分割线
      draw.line([x, 0], [x, height]);

      // 绘制选中单元格对应的行背景
      if (sci <= ii && ii < eci + 1) {
        renderSelectedHeaderCell.call(this, x, 0, colWidth, height);
      }

      // 绘制标签文字
      draw.fillText(stringAt(ii), x + colWidth / 2, height / 2);
    });
    // 绘制标签单元格边框
    draw.line([sumWidth + ntx, 0], [sumWidth + ntx, height]);
    draw.line([0, height], [sumWidth + ntx, height]);
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
  { sri, sci, eri, eci, width, height },
  fixedHeaderWidth,
  fixedHeaderHeight,
  tx,
  ty,
) {
  const { draw, data } = this;
  const { scroll, cols, rows, freeze } = data;
  const [freezeRowIndex, freezeColIndex] = freeze;

  draw.save();
  draw
    .attr(tableGridStyle)
    .translate(fixedHeaderWidth + tx, fixedHeaderHeight + ty);

  draw.clearRect(0, 0, width, height);

  // 绘制行
  data.rowEach(sri, eri, (i, rowY, colHeight) => {
    let offsetY = 0;

    // 判断是否有设置固定行
    if (freezeRowIndex === 0) {
      // 如果没有固定行则按第 0 行开始计算偏移值
      offsetY = scroll.y - rows.sumHeight(0, scroll.rowIndex);
    } else if (
      i + 1 > freezeRowIndex &&
      freezeRowIndex > 0 &&
      scroll.rowIndex > 0
    ) {
      // 如果有固定行则按固定行开始计算偏移值
      offsetY = scroll.y - rows.sumHeight(freezeRowIndex, scroll.rowIndex);
    }

    if (i !== sri) draw.line([0, rowY - offsetY], [width, rowY - offsetY]);
    if (i === eri)
      draw.line(
        [0, rowY - offsetY + colHeight],
        [width, rowY - offsetY + colHeight],
      );
  });

  // 绘制列
  data.colEach(sci, eci, (i, colX, colWidth) => {
    let offsetX = 0;

    // 判断是否有设置固定列
    if (freezeColIndex === 0) {
      // 如果没有固定列则按第 0 列开始计算偏移值
      offsetX = scroll.x - cols.sumWidth(0, scroll.colIndex); // 列偏移值
    } else if (
      i + 1 > freezeColIndex &&
      freezeColIndex > 0 &&
      scroll.colIndex > 0
    ) {
      // 如果有固定列则按固定列开始计算偏移值
      offsetX = scroll.x - cols.sumWidth(freezeColIndex, scroll.colIndex); // 列偏移值
    }

    if (i !== sci) draw.line([colX - offsetX, 0], [colX - offsetX, height]);
    if (i === eci)
      draw.line(
        [colX - offsetX + colWidth, 0],
        [colX - offsetX + colWidth, height],
      );
  });

  draw.restore();
}

/**
 * 渲染固定标签高亮线
 * @param {Number} fixedHeaderWidth 固定标签宽度
 * @param {Number} fixedHeaderHeight 固定标签高度
 * @param {Number} ftw
 * @param {Number} fth
 */
function renderFreezeHighlightLine(
  fixedHeaderWidth,
  fixedHeaderHeight,
  ftw,
  fth,
) {
  const { draw, data } = this;
  const twidth = data.viewWidth() - fixedHeaderWidth;
  const theight = data.viewHeight() - fixedHeaderHeight;
  draw
    .save()
    .translate(fixedHeaderWidth, fixedHeaderHeight)
    .attr({ strokeStyle: 'rgba(75, 137, 255, .6)' });
  draw.line([0, fth], [twidth, fth]);
  draw.line([ftw, 0], [ftw, theight]);
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
    const { cols, rows } = data;

    // 顶部和左边标签栏宽高，修改时需同步修改 sheet.js 里的 getTableOffset
    const fixedHeaderWidth = 30;
    const fixedHeaderHeight = 20;

    this.draw.resize(data.viewWidth(), data.viewHeight());
    this.clear();

    const viewRange = data.viewRange();

    const tx = data.freezeTotalWidth();
    const ty = data.freezeTotalHeight();
    const { x, y } = data.scroll;
    // 1
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

    const [freezeRowIndex, freezeColIndex] = data.freeze;
    if (freezeRowIndex > 0 || freezeColIndex > 0) {
      // 2
      if (freezeRowIndex > 0) {
        // 清除区域 2 底部内容，形成一个遮罩层
        this.draw.clearRect(
          0,
          (rows.sumHeight(0, freezeRowIndex - 1) + fixedHeaderHeight) * 2,
          viewRange.width * 2,
          rows.sumHeight(freezeRowIndex - 1, freezeRowIndex) * 2,
        );

        const vr = viewRange.clone();
        vr.sri = 0;
        vr.eri = freezeRowIndex - 1;
        vr.height = ty;
        renderContentGrid.call(
          this,
          vr,
          fixedHeaderWidth,
          fixedHeaderHeight,
          tx,
          0,
        );
        renderContent.call(
          this,
          vr,
          fixedHeaderWidth,
          fixedHeaderHeight,
          -x,
          0,
        );
        renderFixedHeaders.call(
          this,
          'top',
          vr,
          fixedHeaderWidth,
          fixedHeaderHeight,
          tx,
          0,
        );
      }

      // 3
      if (freezeColIndex > 0) {
        // 清除区域 3 底部内容，形成一个遮罩层
        this.draw.clearRect(
          (cols.sumWidth(0, freezeColIndex - 1) + fixedHeaderWidth) * 2,
          0,
          cols.sumWidth(freezeColIndex - 1, freezeColIndex) * 2,
          viewRange.height * 2,
        );

        const vr = viewRange.clone();
        vr.sci = 0;
        vr.eci = freezeColIndex - 1;
        vr.width = tx;
        renderContentGrid.call(
          this,
          vr,
          fixedHeaderWidth,
          fixedHeaderHeight,
          0,
          ty,
        );
        renderFixedHeaders.call(
          this,
          'left',
          vr,
          fixedHeaderWidth,
          fixedHeaderHeight,
          0,
          ty,
        );
        renderContent.call(
          this,
          vr,
          fixedHeaderWidth,
          fixedHeaderHeight,
          0,
          -y,
        );
      }
      // 4
      const freezeViewRange = data.freezeViewRange();
      renderContentGrid.call(
        this,
        freezeViewRange,
        fixedHeaderWidth,
        fixedHeaderHeight,
        0,
        0,
      );
      renderFixedHeaders.call(
        this,
        'all',
        freezeViewRange,
        fixedHeaderWidth,
        fixedHeaderHeight,
        0,
        0,
      );
      renderContent.call(
        this,
        freezeViewRange,
        fixedHeaderWidth,
        fixedHeaderHeight,
        0,
        0,
      );
      // 5
      renderFreezeHighlightLine.call(
        this,
        fixedHeaderWidth,
        fixedHeaderHeight,
        tx,
        ty,
      );
    }
  }

  clear() {
    this.draw.clear();
  }
}

export default Table;
