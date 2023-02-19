import { PrettyTickValueProvider } from './ticks.js'

export function Axis() {
  // Appearance.
  this.width = 2.0
  this.length = 16.0
  this.color = '#AA00AA'

  // Scale.
  this.minimum = 0.0
  this.maximum = 10.0

  // Scroll.
  this.scrollPosition = this.maximum
  this.scrollGapFraction = 0.8

  // Tick parameters.
  this.nMajorTicks = 5
  this.nMinorTicks = 5

  // Major and minor tick rectangles.
  this.majorTickRects = []
  this.minorTickRects = []

  // Grid line rectangles
  this.majorGridRects = []

  // The parameters used to layout ticks.
  this.tickLayoutParams = {
    min: 0.0,
    max: 0.0,
    step: 0.0,
  }

  // Major and minor tick values.
  this.tickValues = []
  this.minorTickValues = []

  // Axis and associated plot area rectangle.
  this.axisRect = null
  this.plotAreaRect = null

  // Possible axis orientations.
  const orientations = {
    VERTICAL: 'VERTICAL',
    HORIZONTAL: 'HORIZONTAL',
  }

  // Do we need to call init()?
  this.isInit = false

  // Return the orientation of the axis.
  this.orientation = function () {
    if (this.axisRect.width > this.axisRect.height) {
      return orientations.HORIZONTAL
    }
    return orientations.VERTICAL
  }

  // Return the range of the axis.
  this.range = function () {
    return this.maximum - this.minimum
  }

  // Return the number of pixels per axis unit.
  this.pixelsPerAxisUnit = function () {
    const orientation = this.orientation()
    if (orientation === orientations.VERTICAL) {
      return this.axisRect.height / this.range()
    }
    return this.axisRect.width / this.range()
  }

  // Map a value in pixel space to a position in axis space.
  this.mapScreenToAxis = function (x, y) {
    const orientation = this.orientation()
    if (orientation === orientations.VERTICAL) {
      return (
        (this.axisRect.height - (y - this.axisRect.y)) /
          this.pixelsPerAxisUnit() +
        this.minimum
      )
    }
    return (x - this.axisRect.x) / this.pixelsPerAxisUnit() + this.minimum
  }

  // Set the minimum value of the axis.
  this.setMinimum = function (value) {
    if (this.minimum >= this.maximum) {
      return
    }
    this.minimum = value

    // Update tick values and regenerate tick rectangles.
    this.fitTickValues()
    this.generateMajorTickRects()
    this.generateMinorTickRects()
  }

  // Set the maximum value of the axis.
  this.setMaximum = function (value) {
    if (this.maximum <= this.minimum) {
      return
    }
    this.maximum = value

    // Update tick values and regenerate tick rectangles.
    this.fitTickValues()
    this.generateMajorTickRects()
    this.generateMinorTickRects()
  }

  // Pan the ticks of this axis by a specified amount. Pan dimensions are in
  // screen space units. Ticks of horizontal axes are panned by the `x` value,
  // ticks of vertical axes are panned by the `y` value.
  this.pan = function (dx, dy) {
    const orientation = this.orientation()

    // Update the axis limits.
    if (orientation === orientations.VERTICAL) {
      const delta = dy / this.pixelsPerAxisUnit()
      this.minimum += delta
      this.maximum += delta
    } else {
      const delta = dx / this.pixelsPerAxisUnit()
      this.minimum -= delta
      this.maximum -= delta
    }

    // Update the tick values.
    this.fitTickValues()
    this.generateMajorTickRects()
    this.generateMinorTickRects()
  }

  // Scroll the axis. This is different to a `pan` as the renderable
  // representation of the entire series is not recalculated each time.
  //
  // Returns the number of pixels by which to scroll the series.
  this.scroll = function (position) {
    // Update the stored scroll position.
    this.scrollPosition = position

    // Calculate the new maxis maximum, taking into account the scroll gap.
    // If the current scroll position is larger than the calculated scroll
    // position, we don't need to do anything else.
    const scrollGapAdjustedMaximum =
      this.maximum - (1.0 - this.scrollGapFraction) * this.range()
    if (this.scrollPosition < scrollGapAdjustedMaximum) {
      return 0.0
    }

    const deltaAxisUnits = this.scrollPosition - scrollGapAdjustedMaximum
    const deltaPixels = deltaAxisUnits * this.pixelsPerAxisUnit()

    // If we can't pan a whole number of pixels, don't pan at all.
    if (deltaPixels < 0) {
      return 0.0
    }

    // Determine the value by which to adjust the axis limits. Round to the
    // nearest whole pixel to prevent aliasing artifacts when scrolling.
    const panDistanceAxisUnits =
      Math.floor(deltaPixels) / this.pixelsPerAxisUnit()
    this.minimum += panDistanceAxisUnits
    this.maximum += panDistanceAxisUnits

    // Update the tick values.
    this.fitTickValues()
    this.generateMajorTickRects()
    this.generateMinorTickRects()

    return Math.floor(deltaPixels)
  }

  // Scale this axis around a point (e.g. a cursor).
  this.zoom = function (x, y, scale) {
    // Update the axis limits.
    const delta = scale * this.range()
    this.minimum +=
      -1.0 *
      delta *
      ((this.mapScreenToAxis(x, y) - this.minimum) / this.range())
    this.maximum +=
      delta * ((this.maximum - this.mapScreenToAxis(x, y)) / this.range())

    // Update the tick values.
    this.fitTickValues()
    this.generateMajorTickRects()
    this.generateMinorTickRects()
  }

  // Calculate the rectangles for the current minor ticks.
  this.minorTickRects = function () {
    return this.minorTickRects
  }

  // Fit ticks to the current range of the axis.
  this.fitTickValues = function () {
    // If for some reason we have ended up with no tick values,
    // reset the axis to its default state.
    if (this.tickValues.length === 0) {
      this.reset()
    }

    // If the gap from the axis minimum to the first tick is greater than
    // the tick step, fill it from the first tick to the axis minimum.
    if (this.tickValues[0] - this.tickLayoutParams.step >= this.minimum) {
      this.tickValues.push(this.tickValues[0] - this.tickLayoutParams.step)
      while (this.tickValues[this.tickValues.length - 1] >= this.minimum) {
        this.tickValues.push(
          this.tickValues[this.tickValues.length - 1] -
            this.tickLayoutParams.step
        )
      }
    }

    // Sort and remove ticks outside of axis limits. This is a bit lazy, we
    // should really do this above.
    this.tickValues.sort((a, b) => a - b)
    this.tickValues = this.tickValues.filter(
      (x) => x >= this.minimum && x <= this.maximum
    )

    // If the gap from the last tick is greater than the tick step, fill it
    // from the first tick to the axis minimum.
    if (
      this.tickValues[this.tickValues.length - 1] +
        this.tickLayoutParams.step <=
      this.maximum
    ) {
      this.tickValues.push(
        this.tickValues[this.tickValues.length - 1] + this.tickLayoutParams.step
      )
      while (this.tickValues[this.tickValues.length - 1] < this.maximum) {
        this.tickValues.push(
          this.tickValues[this.tickValues.length - 1] +
            this.tickLayoutParams.step
        )
      }
    }

    // Sort and remove ticks outside of axis limits. This is a bit lazy, we
    // should really do this above.
    this.tickValues.sort((a, b) => a - b)
    this.tickValues = this.tickValues.filter(
      (x) => x >= this.minimum && x <= this.maximum
    )

    // Update the minor tick values.
    this.calculateMinorTicks()

    // To keep things tidy, if we have ended up with less than half or more than
    // double of our target number of ticks. Scrap the current tick values and
    // recalculate them.
    if (
      this.tickValues.length < this.nMajorTicks / 2 ||
      this.tickValues.length > 2 * this.nMajorTicks
    ) {
      this.isInit = false
      this.init()
    }
  }

  this.calculateMinorTicks = function () {
    this.minorTickValues = []

    // Handle the case where we have a single major tick.
    if (this.tickValues.length === 1) {
      console.assert('Handle this edge case')
    }

    // Handle the case where we only have a single minor tick for
    // each major tick.
    if (this.nMinorTicks === 1) {
      console.assert('Handle this edge case')
    }

    // Handle the normal case where we have > 1 major tick and > 1 minor ticks
    // per major tick.

    // Fill minor ticks in open interval [0, majorTicks).
    for (let i = 0; i < this.tickValues.length; i++) {
      const currentMajorTickValue = this.tickValues[i]
      const nextMajorTickValue = this.tickValues[i + 1]
      const majorTickDiff = nextMajorTickValue - currentMajorTickValue
      const minorTickStep = majorTickDiff / (this.nMinorTicks + 1.0)
      for (let j = 1; j <= this.nMinorTicks; j++) {
        const minorTickValue = currentMajorTickValue + j * minorTickStep
        this.minorTickValues.push(minorTickValue)
      }
    }

    // Do we need to fill ends?
    if (this.tickValues.length > 1) {
      if (this.minorTickValues.length === 0) {
        return
      }
    }

    const majorTickDiff = this.tickValues[1] - this.tickValues[0]
    const minorTickStep = majorTickDiff / (this.nMinorTicks + 1)

    // Fill from the axis start to the first major tick.
    {
      if (this.tickValues[0] - minorTickStep > this.minimum) {
        let tickValue = this.tickValues[0] - minorTickStep
        this.minorTickValues.push(tickValue)
        while (tickValue - minorTickStep > this.minimum) {
          this.minorTickValues.push(tickValue - minorTickStep)
          tickValue -= minorTickStep
        }
      }
    }

    // Fill from the axis end to the last major tick.
    {
      const lastMajorTick = this.tickValues[this.tickValues.length - 1]
      if (lastMajorTick + minorTickStep < this.maximum) {
        let tickValue = lastMajorTick + minorTickStep
        this.minorTickValues.push(tickValue)
        while (tickValue < this.maximum) {
          this.minorTickValues.push(tickValue)
          tickValue += minorTickStep
        }
      }
    }
  }

  // Handle the special case where we only have a single tick value.
  this.generateSingleTickRect = function () {
    const orientation = this.orientation()
    if (orientation === orientations.VERTICAL) {
      this.majorTickRects.push({
        x: this.axisRect.x - (this.length - this.axisRect.width),
        y: this.axisRect.y + this.axisRect.height / 2.0,
        width: this.width,
        height: this.length,
      })
    } else {
      this.majorTickRects.push({
        x: this.axisRect.x + this.axisRect.width / 2.0,
        y: this.axisRect.y,
        width: this.length,
        height: this.width,
      })
    }
  }

  // Generate tick rectangles from the current tick values.
  this.generateMajorTickRects = function () {
    const orientation = this.orientation()

    // Clean old tick rects.
    this.majorTickRects = []

    // Normalise the tick values.
    const normTickValues = this.tickValues.map(
      (x) => (x - this.minimum) / (this.maximum - this.minimum)
    )

    // Vertical axes ticks are drawn from the top of the axis down.
    if (orientation === orientations.VERTICAL) {
      // Calculate the x offset for all tick values.
      const offset = this.axisRect.x - (this.length - this.axisRect.width)
      for (let i = 0; i < normTickValues.length; i++) {
        const tickIndex = normTickValues.length - i - 1
        // Store the major tick rectangle.
        this.majorTickRects.push({
          x: Math.floor(offset + 0.5),
          y: Math.floor(
            this.axisRect.y +
              (this.axisRect.height -
                Math.floor(normTickValues[tickIndex] * this.axisRect.height))
          ),
          width: this.width,
          height: this.length,
        })
      }
    } else {
      const y = this.axisRect.y + this.axisRect.height - this.length / 2.0
      for (let i = 0; i < normTickValues.length; i++) {
        this.majorTickRects.push({
          x:
            Math.floor(
              this.axisRect.x +
                normTickValues[i] * (this.axisRect.width - this.width)
            ) - 0.5,
          y: Math.floor(y + 0.5),
          width: this.length,
          height: this.width,
        })
      }
    }
  }

  // Generate minor tick rectangles between major tick rects.
  this.generateMinorTickRects = function () {
    // Clear previous tick rectangles.
    this.minorTickRects = []

    const normTickValues = this.minorTickValues.map(
      (x) => (x - this.minimum) / (this.maximum - this.minimum)
    )

    // Vertical axes ticks are drawn from the top of the axis down.
    if (this.orientation() === orientations.VERTICAL) {
      // Calculate the x offset for all tick values.
      const offset =
        this.axisRect.x - (this.length / 2.0 - this.axisRect.width / 2.0)
      for (let i = 0; i < normTickValues.length; i++) {
        const tickIndex = normTickValues.length - i - 1
        this.minorTickRects.push({
          x: Math.floor(offset),
          y: Math.floor(
            this.axisRect.y +
              (this.axisRect.height -
                normTickValues[tickIndex] * this.axisRect.height)
          ),
          width: this.width,
          height: Math.floor(this.length / 2.0),
        })
      }
    } else {
      const y =
        this.axisRect.y +
        this.axisRect.height -
        (this.axisRect.height / 2.0 - this.width / 2.0)
      for (let i = 0; i < normTickValues.length; i++) {
        this.minorTickRects.push({
          x: Math.floor(
            this.axisRect.x +
              normTickValues[i] * (this.axisRect.width - this.width)
          ),
          y: Math.floor(y),
          width: Math.floor(this.length / 2.0),
          height: this.width,
        })
      }
    }
  }

  // Reset the axis to its default parameters.
  this.reset = function () {
    this.isInit = false
    this.init()
  }

  // Get the axis into a sensible initial state.
  this.init = function () {
    if (this.isInit) {
      return
    }
    this.isInit = true

    // Handle the special case where the axis only has a single tick.
    if (this.nMajorTicks === 1) {
      this.tickValues = [(this.maximum - this.minimum) / 2.0]
      this.generateSingleTickRect()
      return
    }

    // Calculate the tick layout parameters and generate the tick values.
    const tickLayoutProvider = new PrettyTickValueProvider(
      this.minimum,
      this.maximum,
      this.nMajorTicks
    )
    this.tickLayoutParams = tickLayoutProvider.parameters()
    this.tickValues = [this.tickLayoutParams.min]
    while (
      this.tickValues[this.tickValues.length - 1] <= this.tickLayoutParams.max
    ) {
      this.tickValues.push(
        this.tickLayoutParams.min +
          this.tickValues.length * this.tickLayoutParams.step
      )
    }

    // Make sure the tick values conform to our axis limits and generate
    // the tick rectangles.
    this.fitTickValues()
    this.generateMajorTickRects()
    this.generateMinorTickRects()
    this.isInit = true
  }

  // Draw the axis body.
  this.drawAxisBody = function (ctx) {
    ctx.fillStyle = '#d62828'
    ctx.fillRect(
      this.axisRect.x,
      this.axisRect.y,
      this.axisRect.width,
      this.axisRect.height
    )
  }

  // Draw tick rectangles.
  this.drawTickRects = function (ctx) {
    // Draw major ticks.
    for (let i = 0; i < this.majorTickRects.length; i++) {
      ctx.fillStyle = '#fcbf49'
      ctx.fillRect(
        this.majorTickRects[i].x,
        this.majorTickRects[i].y,
        this.majorTickRects[i].height,
        this.majorTickRects[i].width
      )
    }

    // Draw minor ticks.
    for (let i = 0; i < this.minorTickRects.length; i++) {
      ctx.fillStyle = '#fcbf49'
      ctx.fillRect(
        this.minorTickRects[i].x,
        this.minorTickRects[i].y,
        this.minorTickRects[i].height,
        this.minorTickRects[i].width
      )
    }
  }

  // Draw grid line rectangles.
  this.drawGridRects = function (ctx) {
    if (this.orientation() === orientations.VERTICAL) {
      // Draw major grid lines.
      for (let i = 0; i < this.majorTickRects.length; i++) {
        ctx.fillStyle = '#fcbf4933'
        ctx.fillRect(
          this.axisRect.x + this.axisRect.width,
          this.majorTickRects[i].y,
          this.plotAreaRect.width,
          this.majorTickRects[i].width
        )
      }

      // Draw minor grid lines.
      for (let i = 0; i < this.minorTickRects.length; i++) {
        ctx.fillStyle = '#fcbf4919'
        ctx.fillRect(
          this.axisRect.x + this.axisRect.width,
          this.minorTickRects[i].y,
          this.plotAreaRect.width,
          this.minorTickRects[i].width
        )
      }
    } else {
      // Draw major grid lines.
      for (let i = 0; i < this.majorTickRects.length; i++) {
        ctx.fillStyle = '#fcbf4933'
        ctx.fillRect(
          this.majorTickRects[i].x,
          this.plotAreaRect.y,
          this.majorTickRects[i].height,
          this.plotAreaRect.height
        )
      }

      // Draw minor grid lines.
      for (let i = 0; i < this.minorTickRects.length; i++) {
        ctx.fillStyle = '#fcbf4919'
        ctx.fillRect(
          this.minorTickRects[i].x,
          this.plotAreaRect.y,
          this.minorTickRects[i].height,
          this.plotAreaRect.height
        )
      }
    }
  }

  // Draw tick labels.
  this.drawTickLabels = function (ctx) {
    if (this.orientation() === orientations.VERTICAL) {
      for (let i = 0; i < this.tickValues.length; i++) {
        const message = this.tickValues[this.tickValues.length - 1 - i]
          .toFixed(3)
          .toString()
        ctx.font = '10pt DejaVu Sans Mono'
        ctx.fillStyle = 'white'

        // Correction factor to center text.
        const cf =
          (ctx.measureText(message).actualBoundingBoxAscent +
            ctx.measureText(message).actualBoundingBoxDescent) /
          2.0

        ctx.fillText(
          message,
          this.majorTickRects[i].x - ctx.measureText(message).width - 2,
          this.majorTickRects[i].y + cf
        )
      }
    } else {
      for (let i = 0; i < this.tickValues.length; i++) {
        const label = this.tickValues[i].toFixed(3).toString()
        ctx.font = '10pt DejaVu Sans Mono'
        ctx.fillStyle = 'white'
        ctx.fillText(
          label,
          this.majorTickRects[i].x - ctx.measureText(label).width / 2.0 + 1, // Correct for tick width.
          this.majorTickRects[i].y + 28.0
        )
      }
    }
  }

  // Draw the axis, ticks and labels to the specified context.
  this.draw = function (ctx) {
    ctx.translate(0.5, 0.5)
    this.drawAxisBody(ctx)
    this.drawTickRects(ctx)
    this.drawGridRects(ctx)
    this.drawTickLabels(ctx)
    ctx.translate(-0.5, -0.5)
  }
}
