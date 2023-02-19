import { Femtochart } from './femtochart.js'

let fc = new Femtochart()
fc.init(document.getElementById('container'))

let series = fc.addSeries('default')

let x = []
let y = []

let step = 0.001
let xValue = 0
for (let i = 0; i <= 10 / step; i++) {
  xValue = xValue + step
  x.push(xValue)
  y.push(Math.sin(xValue) + 5 + Math.random() * 2.5)
}

series.append(x, y, false)
fc.draw(false)
