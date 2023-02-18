// Talbot, J., Lin, S. and Hanrahan, P., 2010.
// An extension of Wilkinson’s algorithm for positioning tick labels on axes.
// IEEE Transactions on visualization and computer graphics, 16(6), pp.1036-1043.
export function PrettyTickValueProvider(axisMinimum, axisMaximum, numTicks) {
  this.axisMinimum = axisMinimum
  this.axisMaximum = axisMaximum
  this.nMajorTicks = numTicks

  this.niceNumbers = [1.0, 5.0, 2.0, 2.5, 4.0, 3.0]
  this.lMinBest = 0.0
  this.lMaxBest = 0.0
  this.lStepBest = 0.0

  // Return the pretty tick parameters.
  this.parameters = function () {
    // Determine the best tick parameters.
    this.wilkinson()

    // Check our parameters are sensible
    console.assert(
      this.lMinBest !== this.lMaxBest,
      'lMinBest unexpectedly equal to lMaxBest',
      this.lMinBest
    )

    console.assert(this.lStepBest > 0.0, 'unexpected lStepBest', this.lStepBest)

    return { min: this.lMinBest, max: this.lMaxBest, step: this.lStepBest }
  }

  // Generate proposed tick offset and spacings for j ticks.
  this.spacings = function (j) {
    let steps = []
    let offsets = []
    for (let i = 0; i < this.niceNumbers.length; i++) {
      const denominator = Math.pow(
        10,
        Math.floor(Math.log10(this.niceNumbers[i] * j))
      )
      const step = (this.niceNumbers[i] * j) / denominator
      steps.push(step)
      let cOffsets = []
      for (let i = 0; i < j; ++i) {
        const offset = (this.niceNumbers[i] * i) / denominator
        cOffsets.push(offset)
      }
      offsets.push(cOffsets)
    }

    return { steps: steps, offsets: offsets }
  }

  this.simplicity = function (i, j, includesZero) {
    const v = includesZero ? 1.0 : 0.0
    const fraction = (1.0 * i) / (this.niceNumbers.length - 1.0)
    return 1.0 - fraction - j + v
  }

  this.coverage = function (dMin, dMax, lMin, lMax) {
    const numerator = Math.pow(dMax - lMax, 2) + Math.pow(dMin - lMin, 2)
    const denominator = Math.pow(0.1 * (dMax - dMin), 2)
    return 1 - 0.5 * (numerator / denominator)
  }

  this.coverageMax = function (dMin, dMax, span) {
    const range = dMax - dMin
    if (span > range) {
      const half = (span - range) / 2.0
      return (
        1.0 -
        (0.5 * (Math.pow(half, 2) + Math.pow(half, 2))) /
          Math.pow(0.1 * range, 2.0)
      )
    }
    return 1.0
  }

  this.density = function (k, target, dMin, dMax, lMin, lMax) {
    const density = (k - 1) / (lMax - lMin)
    const targetDensity =
      (target - 1) / (Math.max(lMax, dMax) - Math.max(dMin, lMin))
    return 2 - Math.max(density / targetDensity, targetDensity / density)
  }

  this.densityMax = function (k, target) {
    if (k >= target) return 2.0 - (1.0 * k - 1) / (1.0 * target - 1)
    return 1.0
  }

  this.score = function (simplicity, coverage, density) {
    return 0.2 * simplicity + 0.25 * coverage + 0.5 * density
  }

  this.wilkinson = function () {
    const targetNumberOfLabels = this.nMajorTicks
    let lMin, lMax, lStep
    const dMin = this.axisMinimum
    const dMax = this.axisMaximum

    let terminate = false
    let bestScore = -2.0
    const maxIterations = 1 << 30
    for (let j = 1; j < maxIterations && !terminate; ++j) {
      const stepsAndOffsets = this.spacings(j)
      for (let i = 0; i < stepsAndOffsets.steps.length; ++i) {
        const q = stepsAndOffsets.steps[i]
        let simplicityScore = this.simplicity(i, j, true)
        let currentScore = this.score(simplicityScore, 1.0, 1.0)
        if (currentScore < bestScore) {
          terminate = true
          break
        }
        for (let k = 2; k < maxIterations; ++k) {
          let densityScore = this.densityMax(k, targetNumberOfLabels)
          currentScore = this.score(simplicityScore, 1.0, densityScore)
          if (currentScore < bestScore) {
            break
          }
          const delta = (dMax - dMin) / (k + 1) / (j + q)
          let zStart = Math.ceil(Math.log10(delta))
          for (; zStart < maxIterations; ++zStart) {
            lStep = q * j * Math.pow(10, zStart)
            let coverageScore = this.coverageMax(dMin, dMax, (k - 1) * lStep)
            currentScore = this.score(
              simplicityScore,
              coverageScore,
              densityScore
            )
            if (currentScore < bestScore) {
              break
            }
            let minStart = Math.floor(dMax / lStep) - (k - 1)
            const maxStart = Math.ceil(dMin / lStep) * j
            if (minStart > maxStart) {
              ++zStart
              continue
            }
            for (; minStart < maxStart; ++minStart) {
              lMin = minStart * lStep
              lMax = lMin + (k - 1) * lStep
              simplicityScore = this.simplicity(i, j, true)
              densityScore = this.density(
                k,
                targetNumberOfLabels,
                dMin,
                dMax,
                lMin,
                lMax
              )
              coverageScore = this.coverage(dMin, dMax, lMin, lMax)
              currentScore = this.score(
                simplicityScore,
                coverageScore,
                densityScore
              )
              if (currentScore < bestScore) continue
              if (currentScore > bestScore) {
                bestScore = currentScore
                this.lMinBest = lMin
                this.lMaxBest = lMax
                this.lStepBest = lStep
              }
            }
          }
        }
      }
    }
  }
}
