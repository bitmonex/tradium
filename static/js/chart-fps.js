import { ChartConfig } from './chart-config.js';

export class FPS {
    constructor(view) {
        this.view = view;
        this.fpsText = new PIXI.Text('FPS: 0', {
            ...PIXI.Text.defaultStyle,
            fill: ChartConfig.fps.fpsColor
        });
        this.fpsText.position.set(15, 40);
        this.view.addChild(this.fpsText);
        this.lastTime = performance.now();
        this.frameCount = 0;
        this.update = this.update.bind(this);
        requestAnimationFrame(this.update);
    }

    update(currentTime) {
        this.frameCount++;

        const elapsed = currentTime - this.lastTime;
        if (elapsed >= 1000) {
            const fps = Math.round((this.frameCount * 1000) / elapsed);
            this.fpsText.text = `FPS: ${fps}`;
            this.lastTime = currentTime;
            this.frameCount = 0;
        }
        requestAnimationFrame(this.update);
    }
}
