// chart-fps.js
import { MEM } from './chart-utils.js';

export class FPS {
  constructor(config, options = {}) {
    this.showMemory = options.showMemory ?? true;
    this.dom = document.querySelector(".m-fps");
    if (!this.dom) {
      console.warn("⚠️ Модуль .m-fps не найден в шаблоне");
      return;
    }
    this.lastTime = performance.now();
    this.frameCount = 0;
    this.update = this.update.bind(this);
    this._alive = true;
    requestAnimationFrame(this.update);
  }
  update(currentTime) {
    if (!this._alive) return;
    this.frameCount++;
    const elapsed = currentTime - this.lastTime;
    if (elapsed >= 500) {
      const fps = Math.round((this.frameCount * 1000) / elapsed);
      let html = `FPS: ${fps}`;
      if (this.showMemory) {
        const mem = MEM();
        if (mem) {
          html += `<br>Mem: ${mem.usedJSHeap} MB`;
        }
      }
      this.dom.innerHTML = html;
      this.lastTime = currentTime;
      this.frameCount = 0;
    }
    requestAnimationFrame(this.update);
  }
  destroy() {
    this._alive = false;
    if (this.dom) {
      this.dom.innerHTML = "";
    }
  }
}