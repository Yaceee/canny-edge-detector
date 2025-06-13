const defaultOptions = {
    lowThreshold: 10,
    highThreshold: 30,
    gaussianBlur: 1.1
};

const Gx = [
    [-1, 0, +1],
    [-2, 0, +2],
    [-1, 0, +1]
];

const Gy = [
    [-1, -2, -1],
    [0, 0, 0],
    [+1, +2, +1]
];

const convOptions = {
    bitDepth: 32,
    border: 'periodic'
};

export default function cannyEdgeDetector(image, options) {
    image.checkProcessable('Canny edge detector', {
        bitDepth: 8,
        channels: 1,
        components: 1
    });

    options = { ...defaultOptions, ...options};

    const width = image.width;
    const height = image.height;
    const brightness = image.maxValue;

    const gfOptions = {
        sigma: options.gaussianBlur,
        radius: 3
    };

    const gf = image.gaussianFilter(gfOptions);

    const gradientX = gf.convolution(Gx, convOptions);
    const gradientY = gf.convolution(Gy, convOptions);

    const G = gradientX.hypotenuse(gradientY);

    const Image = image.constructor;

    const nms = new Image(width, height, {
        kind: 'GREY',
        bitDepth: 32
    });

    const edges = new Image(width, height, {
        kind: 'GREY',
        bitDepth: 32
    });

    const finalImage = new Image(width, height, {
        kind: 'GREY'
    });

    // Non-Maximum supression
    for (let column = 1; column < width - 1; column++) {
        for (let row = 1; row < height - 1; row++) {
            const currentGradientX = gradientX.getValueXY(column, row, 0);
            const currentGradientY = gradientY.getValueXY(column, row, 0);
            const currentGradient = G.getValueXY(column, row, 0);

            const angle = Math.atan2(currentGradientY, currentGradientX) * (4 / Math.PI);
            let dir = ((Math.round(angle) + 4) % 4);

            let before = 0;
            let after = 0;

            // horizontal
            if (dir === 0) {
                before = G.getValueXY(column - 1, row, 0);
                after = G.getValueXY(column + 1, row, 0);
            // upward slope
            } else if (dir === 1) {
                before = G.getValueXY(column - 1, row - 1, 0);
                after = G.getValueXY(column + 1, row + 1, 0);
            // vertical
            } else if (dir === 2) {
                before = G.getValueXY(column, row - 1, 0);
                after = G.getValueXY(column, row + 1, 0);
            // downward slope
            } else if (dir === 3) {
                before = G.getValueXY(column - 1, row + 1, 0);
                after = G.getValueXY(column + 1, row - 1, 0);
            }

            if (currentGradient >= before && currentGradient >= after) {
                nms.setValueXY(column, row, 0, currentGradient);
            }
        }
    }

    for (let i = 0; i < width * height; ++i) {
        const value = nms.data[i];
        if (value >= options.highThreshold) {
            edges.data[i] = 2;
            finalImage.data[i] = brightness;
        } else if (value >= options.lowThreshold) {
            edges.data[i] = 1;
        } else {
            edges.data[i] = 0;
        }
    }

    // Hysteresis: first pass
    let currentPixels = [];
    for (let i = 1; i < width - 1; ++i) {
        for (let j = 1; j < height - 1; ++j) {
            if (edges.getValueXY(i, j, 0) !== 1) continue;

            for (let k = -1; k <= 1; k++) {
                for (let l = -1; l <= 1; l++) {
                    if (edges.getValueXY(i + k, j + l, 0) === 2) {
                        currentPixels.push([i, j]);
                        finalImage.setValueXY(i, j, 0, brightness);
                        break;
                    }
                }
            }
        }
    }

    // Hysteresis: second pass
    while (currentPixels.length > 0) {
        const newPixels = [];
        for (const [x, y] of currentPixels) {
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const nx = x + dx; const ny = y + dy;
                    if (edges.getValueXY(nx, ny, 0) === 1 && finalImage.getValueXY(nx, ny, 0) === 0) {
                        newPixels.push([nx, ny]);
                        finalImage.setValueXY(nx, ny, 0, brightness);
                    }
                }
            }
        }
        currentPixels = newPixels;
    }

    return finalImage;
}
