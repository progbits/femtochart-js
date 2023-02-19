import { Series } from './series.js'
import { Axis } from './axis.js'
import { Renderer } from './renderer.js'

export function Femtochart() {
  // Plot canvas.
  this.plot_canvas = {
    element: null,
    ctx: null,
  }

  // Overlay canvas
  this.overlay_canvas = {
    element: null,
    ctx: null,
  }

  // The series rendered by the chart.
  this.series = new Map()

  this.axisWidth = 8
  this.leftMargin = 89
  this.rightMargin = 76
  this.topMargin = 69
  this.bottomMargin = 73

  // By default, charts have a left x and bottom y axis.
  this.xAxis = null
  this.yAxis = null

  // Create a new Femtochart instance, creating the required DOM elements
  // inside the provided `container`.
  this.init = function (container) {
    container.style['position'] = 'relative'

    // Create the plot canvas, this will hold the main webgl context.
    this.plot_canvas.element = document.createElement('canvas')
    this.plot_canvas.ctx =
      this.plot_canvas.element.getContext('experimental-webgl')
    this.plot_canvas.element.style['width'] = '100%'

    // Create the overlay canvas on which to render any axes, labels etc...
    this.overlay_canvas.element = document.createElement('canvas')
    this.overlay_canvas.ctx = this.overlay_canvas.element.getContext('2d')
    this.overlay_canvas.element.style['width'] = '100%'
    this.overlay_canvas.element.style['position'] = 'absolute'

    // Add the plot and overlay canvas elements to the provided container.
    container.appendChild(this.overlay_canvas.element)
    container.appendChild(this.plot_canvas.element)

    // Add event listeners for plot interactivity.
    this.addCanvasEventListeners()

    // Ensure the canvas dimensions match the size of the container.
    this.onResize()

    // Setup the axes.
    this.xAxis = new Axis()
    this.xAxis.axisRect = this.axisRect('x')
    this.xAxis.plotAreaRect = this.plotRect()
    this.xAxis.init()

    this.yAxis = new Axis()
    this.yAxis.axisRect = this.axisRect('y')
    this.yAxis.plotAreaRect = this.plotRect()
    this.yAxis.init()

    // Setup the renderer.
    this.renderer = new Renderer()
    this.renderer.init(this.plot_canvas.ctx, this.plotRect())
  }

  this.addCanvasEventListeners = function () {
    const canvas = this.overlay_canvas.element

    // Start panning on mouse down.
    canvas.addEventListener('mousedown', (event) => {
      this.mouseDown = true
      this.xMousePos = event.offsetX
      this.yMousePos = event.offsetY
    })

    // Stop panning on mouse up.
    canvas.addEventListener('mouseup', (event) => {
      this.mouseDown = false
      this.xMousePos = event.offsetX
      this.yMousePos = event.offsetY
    })

    // Pan and zoom on mouse move and wheel, respectively.
    canvas.addEventListener('mousemove', this.pan.bind(this))
    canvas.addEventListener('wheel', this.scroll.bind(this))
  }

  this.addSeries = function (name) {
    const series = new Series(this.xAxis, this.yAxis)
    this.series.set(name, series)
    return series
  }

  this.pan = function (event) {
    if (!this.mouseDown) {
      return
    }

    const t0 = performance.now()

    // Clear the canvas.
    this.overlay_canvas.ctx.clearRect(
      0,
      0,
      this.overlay_canvas.element.width,
      this.overlay_canvas.element.height
    )

    // Pan the axes.
    const dx = event.offsetX - this.xMousePos
    const dy = event.offsetY - this.yMousePos
    this.xAxis.pan(dx, dy)
    this.yAxis.pan(dx, dy)

    // Update the mouse state.
    this.xMousePos = event.offsetX
    this.yMousePos = event.offsetY

    // If we have any series, mark them all as dirty and redraw.
    console.log('this.series.size > 0', this.series.size > 0)
    if (this.series.size > 0) {
      this.series.forEach((value) => {
        value.dirty = true
      })
    }

    // Redraw.
    this.draw()

    const t1 = performance.now()
    console.log('mousemove took:', t1 - t0, 'ms')
  }

  this.scroll = function (event) {
    event.preventDefault()

    const t0 = performance.now()

    // Clear the previous contents of the canvas.
    this.overlay_canvas.ctx.clearRect(
      0,
      0,
      this.overlay_canvas.element.width,
      this.overlay_canvas.element.height
    )

    // Zoom and re-draw the axes.
    const zoomScale = event.deltaY < 0 ? -0.05 : 0.05
    this.xAxis.zoom(event.offsetX, event.offsetY, zoomScale)
    this.yAxis.zoom(event.offsetX, event.offsetY, zoomScale)

    // If we have any series, mark them all as dirty and redraw.
    if (this.series.size > 0) {
      this.series.forEach((value) => {
        value.dirty = true
      })
    }

    // Redraw.
    this.draw()

    const t1 = performance.now()
    console.log('Zoom took:', t1 - t0, 'ms')
  }

  this.draw = function (force) {
    // Clear the overlay canvas and redraw the chart axes.
    this.overlay_canvas.ctx.clearRect(
      0,
      0,
      this.overlay_canvas.element.width,
      this.overlay_canvas.element.height
    )

    // Draw axes.
    this.xAxis.draw(this.overlay_canvas.ctx)
    this.yAxis.draw(this.overlay_canvas.ctx)

    // The force parameter is a lazy way of redrawing all series without
    // having to use events, e.g. when axis scales change.
    if (force) {
      this.series.forEach((value) => {
        value.dirty = true
      })
    }

    // If there are no series, there is nothing else to draw.
    if (this.series.size === 0) {
      return
    }

    // If we have any series, draw them.
    const plotRect = this.plotRect()
    this.series.forEach((value) => {
      this.renderer.renderSeries(value, plotRect)
    })
  }

  // Called when the window is resized.
  this.onResize = function () {
    // Get the display size of the plot canvas
    const width = this.plot_canvas.element.clientWidth
    const height = this.plot_canvas.element.clientHeight

    // Update the plot canvas resolution to match the display size.
    this.plot_canvas.element.width = width
    this.plot_canvas.element.height = height

    // Update the overlay canvas resolution to match the display size.
    this.overlay_canvas.element.width = width
    this.overlay_canvas.element.height = height
  }

  // Calculate the plot area rectangle.
  this.plotRect = function () {
    return {
      x: this.leftMargin + this.axisWidth,
      y: this.topMargin - this.axisWidth,
      width:
        this.plot_canvas.element.width - this.leftMargin - this.rightMargin,
      height:
        this.plot_canvas.element.height - this.bottomMargin - this.topMargin,
    }
  }

  // Calculate the rectangle for the specified axis.
  this.axisRect = function (axis) {
    if (axis === 'x') {
      return {
        x: this.leftMargin + this.axisWidth,
        y: this.plot_canvas.element.height - this.bottomMargin - this.axisWidth,
        width:
          this.plot_canvas.element.width - this.rightMargin - this.leftMargin,
        height: this.axisWidth,
      }
    } else if (axis === 'y') {
      return {
        x: this.leftMargin,
        y: this.topMargin - this.axisWidth,
        width: this.axisWidth,
        height:
          this.plot_canvas.element.height - this.topMargin - this.bottomMargin,
      }
    }
    console.assert('Invalid axis: ', axis.toLowerCase())
  }
}
