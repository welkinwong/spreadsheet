import { h } from '../lib/element';
import { mouseMoveUp } from '../lib/event';

export default class Resizer {
  constructor(vertical = false, minDistance) {
    this.moving = false;
    this.vertical = vertical;
    this.el = h(
      'div',
      `spreadsheet-resizer ${vertical ? 'vertical' : 'horizontal'}`,
    )
      .children(
        (this.hoverEl = h(
          'div',
          'spreadsheet-resizer-hover',
        ).on('mousedown.stop', event => this.mousedownHandler(event))),
        (this.lineEl = h('div', 'spreadsheet-resizer-line').hide()),
      )
      .hide();
    // cell rect
    this.cRect = null;
    this.finishedFn = null;
    this.minDistance = minDistance;
  }

  // rect : {top, left, width, height}
  // line : {width, height}
  show(rect, line) {
    const { moving, vertical, hoverEl, lineEl, el } = this;
    if (moving) return;
    this.cRect = rect;
    const { left, top, width, height } = rect;
    el.offset({
      left: vertical ? left + width - 5 : left,
      top: vertical ? top : top + height - 5,
    }).show();
    hoverEl.offset({
      width: vertical ? 5 : width,
      height: vertical ? height : 5,
    });
    lineEl.offset({
      width: vertical ? 0 : line.width,
      height: vertical ? line.height : 0,
    });
  }

  hide() {
    this.el
      .offset({
        left: 0,
        top: 0,
      })
      .hide();
  }

  mousedownHandler(event) {
    let startEvt = event;
    const { el, lineEl, cRect, vertical, minDistance } = this;
    let distance = vertical ? cRect.width : cRect.height;
    // console.log('distance:', distance);
    lineEl.show();
    mouseMoveUp(
      window,
      e => {
        this.moving = true;
        if (startEvt !== null && e.buttons === 1) {
          // console.log('top:', top, ', left:', top, ', cRect:', cRect);
          if (vertical) {
            distance += e.movementX;
            if (distance > minDistance) {
              el.css('left', `${cRect.left + distance}px`);
            }
          } else {
            distance += e.movementY;
            if (distance > minDistance) {
              el.css('top', `${cRect.top + distance}px`);
            }
          }
          startEvt = e;
        }
      },
      () => {
        startEvt = null;
        lineEl.hide();
        this.moving = false;
        this.hide();
        if (this.finishedFn) {
          if (distance < minDistance) distance = minDistance;
          this.finishedFn(cRect, distance);
        }
      },
    );
  }
}
