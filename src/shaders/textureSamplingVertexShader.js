export default `
    attribute vec3 coordinates;
    attribute vec2 textureCoordinates;

    varying highp vec2 vTextureCoord;

    void main() {
        gl_Position = vec4(coordinates, 1.0);
        vTextureCoord = textureCoordinates;
    }
`
