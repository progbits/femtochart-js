export function Femtochart() {
    // Plot canvas.
    this.plot_canvas = {
        element: null,
        ctx: null
    }

    // Overlay canvas
    this.overlay_canvas = {
        element: null,
        ctx: null,
    }

    // Create a new Femtochart instance, creating the required DOM elements
    // inside the provided `container`.
    this.init = function(container) {
        container.style["position"] = "relative";

        // Create the plot canvas, this will hold the main webgl context.
        this.plot_canvas.element = document.createElement("canvas")
        this.plot_canvas.ctx = this.plot_canvas.element.getContext('experimental-webgl');
        this.plot_canvas.element.style["width"] = "100%";

        // Create the overlay canvas on which to render any axes, labels etc...
        this.overlay_canvas.element = document.createElement("canvas");
        this.overlay_canvas.ctx = this.overlay_canvas.element.getContext('2d');
        this.overlay_canvas.element.style["width"] = "100%";
        this.overlay_canvas.element.style["position"] = "absolute";

        // Add the plot and overlay canvas elements to the provided container.
        container.appendChild(this.overlay_canvas.element)
        container.appendChild(this.plot_canvas.element)
    }
}