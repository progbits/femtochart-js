export function Series(xAxis, yAxis) {
  // Series Data.
  this.x = []
  this.y = []

  // Renderable representation of series data.
  this._decimated = []
  this._lookup = []

  // Range of axes are used to decimate data.
  this.xAxis = xAxis
  this.yAxis = yAxis

  // Do we need to recalculate the renderable description?
  this.dirty = false

  // Clears the series data.
  this.clear = function () {
    this.x = []
    this.y = []
    this.dirty = true
  }

  // Replaces the current series data.
  this.set = function (x, y) {
    this.x = x
    this.y = y
    this.dirty = true
  }

  // Appends x and y to the current series data.
  this.append = function (x, y, discard) {
    // Append x and y to the current series data.
    this.x.push(...x)
    this.y.push(...y)

    // If the first point of the newly appended data lies above
    // the x axis maximum or the last point of the newly appended
    // data lies below the x axis minimum, then we have nothing else
    // we need to do.
    const numValues = x.length
    const firstPointIndex = this.x.length - numValues
    const noDataInVisibleRange =
      this.x[firstPointIndex] > this.xAxis.maximum ||
      this.x[this.x.length - 1] < this.xAxis.minimum
    if (noDataInVisibleRange) {
      return
    }

    // Find the point to the left of the first visible point in
    // the newly appended data.
    // TODO: Binary search.
    let firstPointIdx = this.x.length - numValues - 1
    for (; firstPointIdx < this.x.length; ++firstPointIdx) {
      if (this.x[firstPointIdx] >= this.xAxis.minimum) {
        if (firstPointIdx > 0) {
          --firstPointIdx
        }
        break
      }
    }

    // Find the point to the right of the last visible point in
    // the newly appended data.
    // TODO: Binary search.
    let lastPointIdx = this.x.length - 1
    for (; lastPointIdx > this.x.length - numValues - 1; --lastPointIdx) {
      if (this.x[lastPointIdx] <= this.xAxis.maximum) {
        if (lastPointIdx < this.x.length - 2) {
          ++lastPointIdx
        }
        break
      }
    }

    // Decimate the new series data into a temporary buffer.
    const appendDecimated = this._decimate(x, y)

    // If we don't have any decimated data (i.e. this._decimated is empty),
    // then all we have to do is copy appendDecimated -> this._decimated.
    if (this._decimated.length === 0) {
      this._decimated = appendDecimated
      this._generateLookupTable()
      return
    }

    // We already have some decimated data, so we have to stitch in the
    // newly decimated samples. If the first bin of the newly decimated
    // samples overlaps with the last bin of the currently decimated
    // samples, min/max merge them.
    const firstBin = Math.trunc(appendDecimated[0])
    let lastBin = 1 << 31 // i32 min
    if (this._decimated.length > 0) {
      lastBin = Math.trunc(this._decimated[this._decimated.length - 4])
    }
    if (firstBin === lastBin) {
      if (appendDecimated[1] > this._decimated[this._decimated.length - 3]) {
        this._decimated[this._decimated.length - 4] = appendDecimated[0]
        this._decimated[this._decimated.length - 3] = appendDecimated[1]
      }
      if (appendDecimated[3] < this._decimated[this._decimated.length - 1]) {
        this._decimated[this._decimated.length - 2] = appendDecimated[2]
        this._decimated[this._decimated.length - 1] = appendDecimated[3]
      }
      // Append the rest of the data, skipping the first bin that we merged.
      for (let i = 4; i < appendDecimated.length; i++) {
        this._decimated.push(appendDecimated[i])
      }
    } else {
      // No overlap between the previous last bin and current first bin
      // so just append the new data to this._decimated.
      for (let i = 0; i < appendDecimated.length; i++) {
        this._decimated.push(appendDecimated[i])
      }
    }

    // Recalculate the lookup table for the newly decimated samples.
    this._generateLookupTable()

    // If we have no interest in ever looking back at the data, we can just
    // keep the decimated samples. Note - This means that series data can only
    // scroll forwards, zooming and panning is no longer possible.
    if (discard !== null && discard) {
      this.x = []
      this.y = []
    }
  }

  // Scroll the series data by the specified number of pixels.
  //
  // distancePixels should normally be a whole number of pixels to
  // prevent scrolling artifacts.
  this.scroll = function (distancePixels) {
    if (distancePixels === 0) {
      return
    }

    // Pan each of the decimated samples by distancePixels.
    for (let i = 0; i < this._decimated.length; i += 4) {
      this._decimated[i] -= distancePixels
      this._decimated[i + 2] -= distancePixels
    }

    // Remove any decimated samples that now lie outside of the plot area.
    let firstOutsideRange = 0
    for (let i = 0; i < this._decimated.length; i += 4) {
      if (this._decimated[i] > 0) {
        firstOutsideRange = i
        break
      }
    }
    if (firstOutsideRange > 0) {
      firstOutsideRange -= 4
    }

    // Left shift the decimated samples to remove those outside range.
    let count = 0
    while (firstOutsideRange < this._decimated.length) {
      this._decimated[count++] = this._decimated[firstOutsideRange++]
    }
    this._decimated = this._decimated.slice(0, count)

    // Regenerate the lookup table.
    this._generateLookupTable()
  }

  // Return the decimated samples.
  this.decimated = function () {
    if (this.dirty) {
      this._generate()
      this.dirty = false
    }
    return this._decimated
  }

  // Return the lookup table.
  this.lookup = function () {
    if (this.dirty) {
      this._generate()
      this.dirty = false
    }
    return this._lookup
  }

  // Generate a renderable description of series data.
  this._generate = function () {
    this._decimated = this._decimate(this.x, this.y)
    this._generateLookupTable()
  }

  // Decimate plot data into a collection of min/max bins.
  this._decimate = function (x, y) {
    const output = []

    // Seed the decimated array with the first plot point.
    let scaled = (x[0] - this.xAxis.minimum) * this.xAxis.pixelsPerAxisUnit()
    output.push(scaled, y[0], scaled, y[0])

    // Decimate the rest of the data.
    let currentBin = Math.trunc(
      (x[0] - this.xAxis.minimum) * this.xAxis.pixelsPerAxisUnit()
    )
    for (let i = 0; i < x.length; i++) {
      scaled = (x[i] - this.xAxis.minimum) * this.xAxis.pixelsPerAxisUnit()
      if (Math.trunc(scaled) === currentBin) {
        // Current sample belongs in the current bin, check if we should
        // replace the current minimum or maximum for the bin.
        if (y[i] < output[output.length - 3]) {
          output[output.length - 4] = scaled
          output[output.length - 3] = y[i]
        }
        if (y[i] > output[output.length - 1]) {
          output[output.length - 2] = scaled
          output[output.length - 1] = y[i]
        }
      } else {
        // Create a new bin.
        output.push(scaled, y[i], scaled, y[i])
      }
      currentBin = Math.trunc(scaled)
    }

    // Scale decimated y values. No point in doing this above until we
    // know our decimated values.
    for (let i = 1; i < output.length; i += 2) {
      output[i] -= yAxis.minimum
      output[i] *= yAxis.pixelsPerAxisUnit()
      output[i] = this.yAxis.axisRect.height - output[i]
    }

    return output
  }

  // Generate a lookup table mapping decimated samples to pixels.
  //
  // Plot data is stored in a texture the width of our plot. As we will
  // rarely have the same number of plot points as we have plot pixels, we need
  // to be able to map each decimated point to a pixel in our plot. This method
  // assigns each decimated min/max pair to a pixel in the plot.
  this._generateLookupTable = function () {
    this._lookup = []

    const maxIndex = this._decimated.length / 4 - 1
    for (let i = 0; i < this.xAxis.axisRect.width; i++) {
      let closest = this._binarySearch(i, this._decimated)
      this._lookup.push(closest - 1 >= 0 ? closest - 1 : 0)
      this._lookup.push(closest)
      this._lookup.push(closest + 1 < maxIndex ? closest + 1 : maxIndex)
      this._lookup.push(closest + 2 < maxIndex ? closest + 2 : maxIndex)
    }
  }

  // Binary search for the nearest point to a target.
  this._binarySearch = function (target, values) {
    if (target < Math.trunc(values[0])) {
      return 0
    } else if (target > Math.trunc(values[values.length - 4])) {
      return values.length / 4
    }

    let lo = 0
    let hi = values.length / 4
    while (lo <= hi) {
      const mid = Math.floor((hi + lo) / 2)
      const index = mid * 4
      if (target < Math.trunc(values[index])) {
        hi = mid - 1
      } else if (target > Math.trunc(values[index])) {
        lo = mid + 1
      } else {
        return mid
      }
    }

    // lo == hi + 1
    return Math.trunc(values[lo * 4]) - target <
      target - Math.trunc(values[hi * 4])
      ? lo
      : hi
  }
}
