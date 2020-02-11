import { h } from '../lib/element';
import Table from './table';

// 重置 Sheet
function sheetReset() {
  this.table.render();
}

// 初始化事件
function sheetInitEvents() {
  window.addEventListener('resize', () => {
    this.reload();
  });
}

// Sheet 主体
export default class Sheet {
  constructor(targetEl, data) {
    this.el = h('div', 'spreadsheet-sheet');
    targetEl.children(this.el);
    this.data = data;
    this.tableEl = h('canvas', 'spreadsheet-table');

    this.el.children(this.tableEl);
    this.table = new Table(this.tableEl.el, data);
    // 初始化事件
    sheetInitEvents.call(this);
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
}
