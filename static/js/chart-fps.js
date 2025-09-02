import { ChartConfig } from './chart-config.js'

export class FPS {
  constructor(view) {
    this.view = view

    const resolution = window.devicePixelRatio

    const style = new PIXI.TextStyle({
      fontFamily: ChartConfig.default.chartFont,
      fontSize: ChartConfig.default.chartFontSize,
      fontWeight: ChartConfig.default.chartFontWeight,
      fill: Number(ChartConfig.fps.fpsColor),
      resolution
    })

    this.fpsText = new PIXI.Text('FPS: 0', style)
    this.fpsText.x = Math.round(15)
    this.fpsText.y = Math.round(40)
    this.view.addChild(this.fpsText)

    this.lastTime = performance.now()
    this.frameCount = 0
    this.update = this.update.bind(this)
    requestAnimationFrame(this.update)
  }

  update(currentTime) {
    this.frameCount++
    const elapsed = currentTime - this.lastTime

    if (elapsed >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / elapsed)
      this.fpsText.text = `FPS: ${fps}`
      this.lastTime = currentTime
      this.frameCount = 0
    }

    requestAnimationFrame(this.update)
  }
}
