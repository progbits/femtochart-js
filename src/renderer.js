import lineSeriesVsSource from './shaders/lineSeriesVertexShader'
import lineSeriesFsSource from './shaders/lineSeriesFragmentShader'
import textureSamplingVsSource from './shaders/textureSamplingVertexShader'
import textureSamplingFsSource from './shaders/textureSamplingFragmentShader'

export function Renderer() {
  // Shader programs.
  this.lineSeriesShaderProgram = null
  this.textureSamplingShaderProgram = null

  // Textures.
  this.lineSeriesPlotDataTexture = null
  this.lineSeriesLookupTableTexture = null
  this.lineSeriesTargetTexture = null

  // Samplers.
  this.lineSeriesLookupTableSampler = null
  this.lineSeriesPlotDataSampler = null
  this.textureSamplingSampler = null

  // Attributes.
  this.lineSeriesVertexAttribute = null
  this.textureSamplingVertexAttribute = null
  this.textureSamplingCoordinateAttribute = null

  // Uniforms.
  this.lineSeriesPlotWidthUniform = null

  // Buffers.
  this.vertexBuffer = null
  this.indexBuffer = null

  this.quadVertices = [
    -1.0, 1.0, 0.0, -1.0, -1.0, 0.0, 1.0, -1.0, 0.0, 1.0, 1.0, 0.0,
  ]

  this.quadIndices = [0, 1, 2, 0, 2, 3]

  this.textureCoordinates = [0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0]

  // Acquires resources needed for rendering.
  this.init = function (context, rect) {
    this.context = context
    this.plotRect = rect

    // Must-have support for floating point textures.
    if (!this.context.getExtension('OES_texture_float')) {
      alert('Floating point texture support required.')
    }

    // Acquire buffers.
    this.vertexBuffer = this.createBuffer(
      new Float32Array(this.quadVertices),
      this.context.ARRAY_BUFFER
    )

    this.textureCoordinateBuffer = this.createBuffer(
      new Float32Array(this.textureCoordinates),
      this.context.ARRAY_BUFFER
    )

    this.indexBuffer = this.createBuffer(
      new Uint16Array(this.quadIndices),
      this.context.ELEMENT_ARRAY_BUFFER
    )

    // Acquire textures.
    this.acquireTextures()

    // Create the line series shader program.
    this.lineSeriesShaderProgram = this.createShaderProgram(
      lineSeriesVsSource,
      lineSeriesFsSource
    )

    // Locate the line series program attributes.
    this.lineSeriesVertexAttribute = this.context.getAttribLocation(
      this.lineSeriesShaderProgram,
      'coordinates'
    )

    this.lineSeriesLookupTableSampler = this.context.getUniformLocation(
      this.lineSeriesShaderProgram,
      'uLookupTableSampler'
    )

    this.lineSeriesPlotDataSampler = this.context.getUniformLocation(
      this.lineSeriesShaderProgram,
      'uPlotDataSampler'
    )

    this.lineSeriesPlotWidthUniform = this.context.getUniformLocation(
      this.lineSeriesShaderProgram,
      'aPlotWidth'
    )

    // Create the texture sampling shader program.
    this.textureSamplingShaderProgram = this.createShaderProgram(
      textureSamplingVsSource,
      textureSamplingFsSource
    )

    // Locate the texture sampling program attributes.
    this.textureSamplingVertexAttribute = this.context.getAttribLocation(
      this.textureSamplingShaderProgram,
      'coordinates'
    )

    this.textureSamplingCoordinateAttribute = this.context.getAttribLocation(
      this.textureSamplingShaderProgram,
      'textureCoordinates'
    )

    this.textureSamplingSampler = this.context.getUniformLocation(
      this.textureSamplingShaderProgram,
      'uSampler'
    )
  }

  this.acquireTextures = function () {
    // Texture which hold the series data and lookup table.
    this.lineSeriesPlotDataTexture = this.context.createTexture()
    this.lineSeriesLookupTableTexture = this.context.createTexture()

    // Texture to render the series to. Should match the dimensions of the plot area.
    this.lineSeriesTargetTexture = this.context.createTexture()
    this.context.bindTexture(
      this.context.TEXTURE_2D,
      this.lineSeriesTargetTexture
    )
    {
      const level = 0
      const internalFormat = this.context.RGBA
      const border = 0
      const format = this.context.RGBA
      const type = this.context.UNSIGNED_BYTE
      const data = null // No initial data.
      this.context.texImage2D(
        this.context.TEXTURE_2D,
        level,
        internalFormat,
        this.plotRect.width,
        this.plotRect.height,
        border,
        format,
        type,
        data
      )

      // No mips.
      this.context.texParameteri(
        this.context.TEXTURE_2D,
        this.context.TEXTURE_MIN_FILTER,
        this.context.LINEAR
      )
      this.context.texParameteri(
        this.context.TEXTURE_2D,
        this.context.TEXTURE_WRAP_S,
        this.context.CLAMP_TO_EDGE
      )
      this.context.texParameteri(
        this.context.TEXTURE_2D,
        this.context.TEXTURE_WRAP_T,
        this.context.CLAMP_TO_EDGE
      )
    }
  }

  this.renderToTexture = function () {
    // Create a new frame buffer and attach the texture as the first color attachment.
    const frameBuffer = this.context.createFramebuffer()
    this.context.bindFramebuffer(this.context.FRAMEBUFFER, frameBuffer)

    const attachmentPoint = this.context.COLOR_ATTACHMENT0
    this.context.framebufferTexture2D(
      this.context.FRAMEBUFFER,
      attachmentPoint,
      this.context.TEXTURE_2D,
      this.lineSeriesTargetTexture,
      0
    )

    // Use the line series shader program.
    this.context.useProgram(this.lineSeriesShaderProgram)

    // Bind the vertex buffer.
    this.context.bindBuffer(this.context.ARRAY_BUFFER, this.vertexBuffer)
    this.context.vertexAttribPointer(
      this.lineSeriesVertexAttribute,
      3,
      this.context.FLOAT,
      false,
      0,
      0
    )
    this.context.enableVertexAttribArray(this.lineSeriesVertexAttribute)

    // Bind the index buffer.
    this.context.bindBuffer(this.context.ELEMENT_ARRAY_BUFFER, this.indexBuffer)

    // Bind the lookup table texture to texture unit 0 and tell the shader.
    this.context.activeTexture(this.context.TEXTURE0)
    this.context.bindTexture(
      this.context.TEXTURE_2D,
      this.lineSeriesLookupTableTexture
    )
    this.context.uniform1i(this.lineSeriesLookupTableSampler, 0)

    // Bind the plot data texture to texture unit 1 and tell the shader.
    this.context.activeTexture(this.context.TEXTURE1)
    this.context.bindTexture(
      this.context.TEXTURE_2D,
      this.lineSeriesPlotDataTexture
    )
    this.context.uniform1i(this.lineSeriesPlotDataSampler, 1)

    // Set the plot width attribute.
    this.context.uniform1f(this.lineSeriesPlotWidthUniform, this.plotRect.width)

    // Setup the viewport to the size of the texture and clear the viewport.
    this.context.viewport(0, 0, this.plotRect.width, this.plotRect.height)
    this.context.clearColor(0.1, 0.1, 0.1, 1.0)
    this.context.clear(this.context.COLOR_BUFFER_BIT)

    // Render the series to the texture.
    this.context.drawElements(
      this.context.TRIANGLES,
      this.quadIndices.length,
      this.context.UNSIGNED_SHORT,
      0
    )
  }

  this.renderToCanvas = function () {
    // Bind the default frame buffer.
    this.context.bindFramebuffer(this.context.FRAMEBUFFER, null)

    // Use the texture sampling shader program.
    this.context.useProgram(this.textureSamplingShaderProgram)

    // Bind the vertex buffer.
    this.context.bindBuffer(this.context.ARRAY_BUFFER, this.vertexBuffer)
    this.context.vertexAttribPointer(
      this.textureSamplingVertexAttribute,
      3,
      this.context.FLOAT,
      false,
      0,
      0
    )
    this.context.enableVertexAttribArray(this.textureSamplingVertexAttribute)

    // Bind the texture coordinate buffer.
    this.context.bindBuffer(
      this.context.ARRAY_BUFFER,
      this.textureCoordinateBuffer
    )
    this.context.vertexAttribPointer(
      this.textureSamplingCoordinateAttribute,
      2,
      this.context.FLOAT,
      false,
      0,
      0
    )
    this.context.enableVertexAttribArray(
      this.textureSamplingCoordinateAttribute
    )

    // Bind the index buffer.
    this.context.bindBuffer(this.context.ELEMENT_ARRAY_BUFFER, this.indexBuffer)

    // Bind the plot data texture to texture unit 0 and tell the shader.
    this.context.activeTexture(this.context.TEXTURE0)
    this.context.bindTexture(
      this.context.TEXTURE_2D,
      this.lineSeriesTargetTexture
    )
    this.context.uniform1i(this.textureSamplingSampler, 0)

    // Set the viewport.
    this.context.viewport(
      this.plotRect.x,
      this.plotRect.y,
      this.plotRect.width,
      this.plotRect.height
    )
    this.context.clearColor(0.1, 0.1, 0.1, 1.0)
    this.context.clear(this.context.COLOR_BUFFER_BIT)

    // Render the texture to the canvas.
    this.context.drawElements(
      this.context.TRIANGLES,
      this.quadIndices.length,
      this.context.UNSIGNED_SHORT,
      0
    )
  }

  this.renderSeries = function (series, rect) {
    // Update the plotRect.
    this.plotRect = rect

    // Update Textures.
    const data = new Float32Array(this.plotRect.width * 4)
    this.copyTextureData(series.decimated(), data)
    this.updateTexture(
      this.lineSeriesPlotDataTexture,
      this.plotRect.width,
      data
    )

    this.copyTextureData(series.lookup(), data)
    this.updateTexture(
      this.lineSeriesLookupTableTexture,
      this.plotRect.width,
      data
    )

    // Setup the common rendering state.
    this.context.enable(this.context.BLEND)
    this.context.blendFuncSeparate(
      this.context.SRC_ALPHA,
      this.context.ONE_MINUS_SRC_ALPHA,
      this.context.ONE,
      this.context.ONE_MINUS_SRC_ALPHA
    )

    // Render the series.
    this.renderToTexture()
    this.renderToCanvas()
  }

  this.copyTextureData = function (source, dest) {
    for (let i = 0; i < this.plotRect.width * 4; i += 4) {
      dest[i] = source[i]
      dest[i + 1] = source[i + 1]
      dest[i + 2] = source[i + 2]
      dest[i + 3] = source[i + 3]
    }
  }

  this.updateTexture = function (texture, width, data) {
    const ctx = this.context
    ctx.bindTexture(ctx.TEXTURE_2D, texture)
    ctx.texImage2D(
      ctx.TEXTURE_2D,
      0,
      ctx.RGBA,
      width,
      1,
      0,
      ctx.RGBA,
      ctx.FLOAT,
      data
    )

    // No mipmap, so set to nearest neighbour and disable wrapping.
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.NEAREST)
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.NEAREST)
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE)
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE)

    // Unbind the texture.
    ctx.bindTexture(ctx.TEXTURE_2D, null)
  }

  this.compileShader = function (source, type) {
    const shader = this.context.createShader(type)
    this.context.shaderSource(shader, source)

    this.context.compileShader(shader)
    const success = this.context.getShaderParameter(
      shader,
      this.context.COMPILE_STATUS
    )
    if (!success) {
      throw 'failed to compile shader:' + this.context.getShaderInfoLog(shader)
    }
    return shader
  }

  this.createShaderProgram = function (
    vertexShaderSource,
    fragmentShaderSource
  ) {
    const vertexShader = this.compileShader(
      vertexShaderSource,
      this.context.VERTEX_SHADER
    )
    const fragmentShader = this.compileShader(
      fragmentShaderSource,
      this.context.FRAGMENT_SHADER
    )

    const program = this.context.createProgram()
    this.context.attachShader(program, vertexShader)
    this.context.attachShader(program, fragmentShader)

    this.context.linkProgram(program)
    const success = this.context.getProgramParameter(
      program,
      this.context.LINK_STATUS
    )
    if (!success) {
      throw 'failed to link program:' + this.context.getProgramInfoLog(program)
    }

    return program
  }

  this.createBuffer = function (data, type) {
    let buffer = this.context.createBuffer()
    this.context.bindBuffer(type, buffer)
    this.context.bufferData(type, data, this.context.STATIC_DRAW)
    this.context.bindBuffer(type, null)
    return buffer
  }

  this.createTexture = function () {
    const texture = this.context.createTexture()
    this.context.bindTexture(this.context.TEXTURE_2D, texture)
  }
}
