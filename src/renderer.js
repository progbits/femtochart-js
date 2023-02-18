const lineSeriesVsSource = `
    attribute vec3 coordinates;
    void main() {
        gl_Position = vec4(coordinates, 1.0);
    }
`

const lineSeriesFsSource = `
    precision highp float;

    uniform float aPlotWidth;

    uniform sampler2D uLookupTableSampler;
    uniform sampler2D uPlotDataSampler;

    // Calculate the distance from a to the line (p1, p2).
    float distanceToSegment(vec2 p1, vec2 p2, vec2 a) {
        // Calculate the length of the segment, clamping small segments.
        float length = max(1e-10, dot(p2 - p1, p2 - p1));
        // Calculate the normalized distance of the point a along the segment.
        float normDist = clamp(dot(a - p1, p2 - p1) / length, 0.0, 1.0);
        return distance(a, mix(p1, p2, normDist));
    }

    void main() {
        // Sample the lookup table texture for the current pixel to get
        // the 4 points that we want to lookup data for.
        float lut_texel_coord = (gl_FragCoord.x - 0.5) / aPlotWidth;
        vec4 lut_texel = texture2D(uLookupTableSampler, vec2(lut_texel_coord, 0.0));

        // Lookup the 4 nearest data points in the plot data texture.
        vec4 p0 = texture2D(uPlotDataSampler, vec2((lut_texel.x + 0.5) / aPlotWidth, 0.0));
        vec4 p1 = texture2D(uPlotDataSampler, vec2((lut_texel.y + 0.5) / aPlotWidth, 0.0));
        vec4 p2 = texture2D(uPlotDataSampler, vec2((lut_texel.z + 0.5) / aPlotWidth, 0.0));
        vec4 p3 = texture2D(uPlotDataSampler, vec2((lut_texel.w + 0.5) / aPlotWidth, 0.0));

        // Expand the 4 nearest points into min/max values.
        vec2 p0_min = vec2(p0.x, p0.y);
        vec2 p0_max = vec2(p0.z, p0.w);
        vec2 p1_min = vec2(p1.x, p1.y);
        vec2 p1_max = vec2(p1.z, p1.w);
        vec2 p2_min = vec2(p2.x, p2.y);
        vec2 p2_max = vec2(p2.z, p2.w);
        vec2 p3_min = vec2(p3.x, p3.y);
        vec2 p3_max = vec2(p3.z, p3.w);

        // Determine the minimum distance from the current pixel to each of the line segments.
        float d = distanceToSegment(p0_min, p0_max, vec2(gl_FragCoord.x, gl_FragCoord.y));
        d = min(d, distanceToSegment(p0_max, p1_min, vec2(gl_FragCoord.x, gl_FragCoord.y)));
        d = min(d, distanceToSegment(p1_min, p1_max, vec2(gl_FragCoord.x, gl_FragCoord.y)));
        d = min(d, distanceToSegment(p1_max, p2_min, vec2(gl_FragCoord.x, gl_FragCoord.y)));
        d = min(d, distanceToSegment(p2_min, p2_max, vec2(gl_FragCoord.x, gl_FragCoord.y)));
        d = min(d, distanceToSegment(p2_max, p3_min, vec2(gl_FragCoord.x, gl_FragCoord.y)));
        d = min(d, distanceToSegment(p3_min, p3_max, vec2(gl_FragCoord.x, gl_FragCoord.y)));

        float lineWidth = 1.6;
        float clampedAlpha = clamp(lineWidth - d, 0.0, 1.0);
        gl_FragColor = vec4(247.0 / 256.0, 127.0 / 256.0, 0.0 / 256.0, clampedAlpha);
    }
`

const textureSamplingVsSource = `
    attribute vec3 coordinates;
    attribute vec2 textureCoordinates;

    varying highp vec2 vTextureCoord;

    void main() {
        gl_Position = vec4(coordinates, 1.0);
        vTextureCoord = textureCoordinates;
    }
`

const textureSamplingFsSource = `
    precision highp float;

    varying highp vec2 vTextureCoord;
    uniform sampler2D uSampler;

    void main() {
        gl_FragColor = texture2D(uSampler, vTextureCoord);
    }
`

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
