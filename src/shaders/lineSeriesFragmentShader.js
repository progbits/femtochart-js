export default `
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
