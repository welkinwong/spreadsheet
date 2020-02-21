import { h } from './lib/element';
import DataProxy from './core/data_proxy';
import Sheet from './component/sheet';
import './index.less';

class Spreadsheet {
  constructor(selectors, options = {}) {
    let targetEl = selectors;
    if (typeof selectors === 'string') {
      targetEl = document.querySelector(selectors);
    }
    this.data = new DataProxy('sheet1', options);
    const rootEl = h('div', 'spreadsheet').on('contextmenu', event =>
      event.preventDefault(),
    );
    // create canvas element
    targetEl.appendChild(rootEl.el);
    this.sheet = new Sheet(rootEl, this.data);
  }

  loadData(data) {
    this.sheet.loadData(data);
    return this;
  }

  getData() {
    return this.data.getData();
  }

  // validate() {
  //   const { validations } = this.data;
  //   return validations.errors.size <= 0;
  // }

  change(callback) {
    this.data.change = callback;
    return this;
  }

  update(ops) {
    this.data.update(ops);
    this.sheet.reload();
    return this;
  }

  // static locale(lang, message) {
  //   locale(lang, message);
  // }
}

const spreadsheet = (el, options = {}) => new Spreadsheet(el, options);

if (window) {
  window.spreadsheet = spreadsheet;
}

export default Spreadsheet;
