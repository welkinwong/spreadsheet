import { CellRange } from './cell_range';
// operator: all|eq|neq|gt|gte|lt|lte|in|be
// value:
//   in => []
//   be => [min, max]
class Filter {
  constructor(colIndex, operator, value) {
    this.colIndex = colIndex;
    this.operator = operator;
    this.value = value;
  }

  set(operator, value) {
    this.operator = operator;
    this.value = value;
  }

  includes(v) {
    const { operator, value } = this;
    if (operator === 'all') {
      return true;
    }
    if (operator === 'in') {
      return value.includes(v);
    }
    return false;
  }

  vlength() {
    const { operator, value } = this;
    if (operator === 'in') {
      return value.length;
    }
    return 0;
  }

  getData() {
    const { colIndex, operator, value } = this;
    return { colIndex, operator, value };
  }
}

class Sort {
  constructor(colIndex, order) {
    this.colIndex = colIndex;
    this.order = order;
  }

  asc() {
    return this.order === 'asc';
  }

  desc() {
    return this.order === 'desc';
  }
}

export default class AutoFilter {
  constructor() {
    this.ref = null;
    this.filters = [];
    this.sort = null;
  }

  setData({ ref, filters, sort }) {
    if (ref != null) {
      this.ref = ref;
      this.fitlers = filters.map(
        it => new Filter(it.colIndex, it.operator, it.value),
      );
      if (sort) {
        this.sort = new Sort(sort.colIndex, sort.order);
      }
    }
  }

  getData() {
    if (this.active()) {
      const { ref, filters, sort } = this;
      return { ref, filters: filters.map(it => it.getData()), sort };
    }
    return {};
  }

  addFilter(colIndex, operator, value) {
    const filter = this.getFilter(colIndex);
    if (filter == null) {
      this.filters.push(new Filter(colIndex, operator, value));
    } else {
      filter.set(operator, value);
    }
  }

  setSort(colIndex, order) {
    this.sort = order ? new Sort(colIndex, order) : null;
  }

  includes(rowIndex, colIndex) {
    if (this.active()) {
      return this.hrange().includes(rowIndex, colIndex);
    }
    return false;
  }

  getSort(colIndex) {
    const { sort } = this;
    if (sort && sort.colIndex === colIndex) {
      return sort;
    }
    return null;
  }

  getFilter(colIndex) {
    const { filters } = this;
    for (let i = 0; i < filters.length; i += 1) {
      if (filters[i].colIndex === colIndex) {
        return filters[i];
      }
    }
    return null;
  }

  filteredRows(getCell) {
    // const ary = [];
    // let lastri = 0;
    const rset = new Set();
    const fset = new Set();
    if (this.active()) {
      const { sri, eri } = this.range();
      const { filters } = this;
      for (let rowIndex = sri + 1; rowIndex <= eri; rowIndex += 1) {
        for (let i = 0; i < filters.length; i += 1) {
          const filter = filters[i];
          const cell = getCell(rowIndex, filter.colIndex);
          const ctext = cell ? cell.text : '';
          if (!filter.includes(ctext)) {
            rset.add(rowIndex);
            break;
          } else {
            fset.add(rowIndex);
          }
        }
      }
    }
    return { rset, fset };
  }

  items(colIndex, getCell) {
    const m = {};
    if (this.active()) {
      const { sri, eri } = this.range();
      for (let rowIndex = sri + 1; rowIndex <= eri; rowIndex += 1) {
        const cell = getCell(rowIndex, colIndex);
        if (cell !== null && !/^\s*$/.test(cell.text)) {
          const key = cell.text;
          const cnt = (m[key] || 0) + 1;
          m[key] = cnt;
        } else {
          m[''] = (m[''] || 0) + 1;
        }
      }
    }
    return m;
  }

  range() {
    return CellRange.valueOf(this.ref);
  }

  hrange() {
    const r = this.range();
    r.eri = r.sri;
    return r;
  }

  clear() {
    this.ref = null;
    this.filters = [];
    this.sort = null;
  }

  active() {
    return this.ref !== null;
  }
}
