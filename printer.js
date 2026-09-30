class ThermalProcessor {
    constructor() {
        this.width = 0;
        this.height = 0;
        this.quality = 'high';
        this.printBrightness = 50; // 0-100
        this.printContrast = 50; // 0-100, 50=normal
        this.printSharpness = 30; // 0-100, 0=off
    }

    /**
     * 10-stage professional thermal pipeline.
     * ditherType: 'floyd' | 'atkinson' | 'jarvis'
     * faceBoxes: [{x,y,width,height}]
     */
    process(imgData, quality = 'high', mode = 'print', debug = false, ditherType = 'floyd', faceBoxes = []) {
        this.width = imgData.width;
        this.height = imgData.height;
        this.quality = quality;
        if (mode === 'color') return imgData;
        if (mode === 'bw' || mode === 'bw_premium') return this._applyBwPreview(imgData);

        const pixels = imgData.data;
        const W = this.width, H = this.height, total = W * H;
        const gray = new Float32Array(total);

        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // SIMPLIFIED PRINT PIPELINE (mode='print')
        // Satu gamma curve saja â€” tidak ada stacking exposure/CLAHE
        // Ini yang menghasilkan output natural seperti referensi print
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        if (mode === 'print') {
            // Stage 1: Grayscale
            for (let i = 0; i < total; i++) {
                const o = i * 4;
                gray[i] = pixels[o] * 0.299 + pixels[o + 1] * 0.587 + pixels[o + 2] * 0.114;
            }

            // Stage 2: Auto-normalize (histogram stretch 2%â€“98%)
            const hist = new Uint32Array(256);
            for (let i = 0; i < total; i++) hist[Math.round(Math.max(0, Math.min(255, gray[i])))]++;
            let cum = 0, p2 = 0, p98 = 255;
            for (let j = 0; j < 256; j++) {
                cum += hist[j];
                if (cum < total * 0.02) p2 = j;
                if (cum < total * 0.98) p98 = j;
            }
            const normRange = Math.max(1, p98 - p2);
            for (let i = 0; i < total; i++) {
                gray[i] = Math.max(0, Math.min(255, (gray[i] - p2) / normRange * 255));
            }

            // Stage 3: Adaptive Gamma (selalu < 1 = selalu lighten)
            // Thermal printer cetak lebih gelap dari screen, harus lighten dulu.
            let meanNorm = 0;
            for (let i = 0; i < total; i++) meanNorm += gray[i];
            meanNorm /= total;

            // brightnessBias: slider 0â†’-0.20, slider 50â†’0, slider 100â†’+0.20
            const brightnessBias = ((this.printBrightness - 50) / 100) * 0.40;
            let baseGamma;
            // Gamma lebih tinggi â†’ pixel lebih terang â†’ lebih jauh di atas threshold Bayer
            // â†’ area terang jadi solid putih bukan titik-titik
            if (meanNorm >= 160) baseGamma = 0.75;  // sangat terang â€” lighten ringan
            else if (meanNorm >= 130) baseGamma = 0.67;  // terang
            else if (meanNorm >= 100) baseGamma = 0.58;  // sedang
            else if (meanNorm >= 70) baseGamma = 0.50;  // agak gelap
            else baseGamma = 0.42;  // gelap â€” lighten agresif
            const printGamma = Math.max(0.15, Math.min(0.95, baseGamma - brightnessBias));

            console.log('[Print] meanNorm=' + meanNorm.toFixed(0) + ' gamma=' + printGamma.toFixed(2)
                + ' brightness=' + this.printBrightness);
            for (let i = 0; i < total; i++) {
                gray[i] = Math.pow(Math.max(0, gray[i]) / 255, printGamma) * 255;
            }

            // Stage 4: Contrast slider
            const cFactor = 0.3 + (this.printContrast / 100) * 1.7;
            if (Math.abs(cFactor - 1.0) > 0.05) {
                let cSum = 0;
                for (let i = 0; i < total; i++) cSum += gray[i];
                const cMid = cSum / total;
                for (let i = 0; i < total; i++)
                    gray[i] = Math.max(0, Math.min(255, cMid + (gray[i] - cMid) * cFactor));
            }

            // Stage 5: Sharpness slider â€” unsharp mask ASIMETRIS
            // Masalah formula standar: (pixel âˆ’ blur) bisa NEGATIF di area gelap
            // â†’ slider sharpness malah bikin foto makin gelap!
            // Fix: diff positif (tepi terang) dapat boost penuh,
            //      diff negatif (tepi gelap) hanya 30% agar tidak over-darken.
            if (this.printSharpness > 0) {
                const sharpAmt = (this.printSharpness / 100) * 0.8;
                const sb = this.fastBoxBlur(gray, W, H, 1);
                for (let i = 0; i < total; i++) {
                    const diff = gray[i] - sb[i];
                    const adj = diff > 0 ? diff * sharpAmt : diff * sharpAmt * 0.30;
                    gray[i] = Math.max(0, Math.min(255, gray[i] + adj));
                }
            }

            // Stage 6: Dithering
            if (ditherType === 'floyd') {
                this.floydSteinbergDither(gray, pixels, 140, W, H);
            } else if (ditherType === 'jarvis') {
                this.jarvisDither(gray, pixels, 140, W, H);
            } else if (ditherType === 'atkinson') {
                this.atkinsonDither(gray, pixels, 140, W, H);
            } else {
                // Default: Bayer 8x8 dengan Highlight & Shadow Protection
                //
                // MASALAH: Bayer 8x8 punya threshold dari ~2 sampai ~253.
                // Pixel bernilai 240 masih bisa jadi HITAM di posisi Bayer threshold 248
                // â†’ inilah penyebab "titik hitam di area putih"!
                //
                // SOLUSI â€” 3 zona:
                //   gray â‰¥ 215  â†’ paksa 255 (putih bersih, NOLL titik hitam)
                //   gray â‰¤  30  â†’ paksa 0   (hitam bersih, tidak ada butiran)
                //   31 â€“ 214    â†’ Bayer dithering (gradien midtone)
                for (let i = 0; i < total; i++) {
                    if (gray[i] >= 230) gray[i] = 255; // highlight protection (longgar = midtone punya dots)
                    else if (gray[i] <= 25) gray[i] = 0;   // shadow protection
                }

                // Pre-blur setelah clamp: menghaluskan transisi antara zona clamped dan dithered
                const blr = this.fastBoxBlur(gray, W, H, 2);
                for (let i = 0; i < total; i++)
                    gray[i] = gray[i] * 0.30 + blr[i] * 0.70;

                // Clamp ulang setelah blur
                for (let i = 0; i < total; i++) {
                    if (gray[i] >= 226) gray[i] = 255;
                    if (gray[i] <= 12) gray[i] = 0;
                }

                this.bayerDither(gray, pixels, W, H);
            }

            return imgData;
        }
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // END SIMPLIFIED PRINT PIPELINE
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

        const debugSteps = [];
        const analytics = {};

        const snap = (name, arr) => {
            if (!debug) return;
            const c = document.createElement('canvas');
            c.width = W; c.height = H;
            const ctx = c.getContext('2d');
            const id = ctx.createImageData(W, H);
            for (let i = 0; i < total; i++) {
                const v = Math.max(0, Math.min(255, arr[i]));
                id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v;
                id.data[i * 4 + 3] = 255;
            }
            ctx.putImageData(id, 0, 0);
            debugSteps.push({ name, canvas: c });
        };

        if (debug) {
            const c = document.createElement('canvas');
            c.width = W; c.height = H;
            c.getContext('2d').putImageData(imgData, 0, 0);
            debugSteps.push({ name: '0. Original', canvas: c });
        }

        // STAGE 1: Grayscale (luminance-weighted)
        for (let i = 0; i < total; i++) {
            const o = i * 4;
            gray[i] = pixels[o] * 0.299 + pixels[o + 1] * 0.587 + pixels[o + 2] * 0.114;
        }
        snap('1. Grayscale', gray);

        // STAGE 2: Auto Exposure Correction via Otsu
        const otsu1 = this.computeOtsu(gray);
        analytics.otsuThreshold = otsu1;
        const expFactor = Math.max(0.5, Math.min(2.0, 135 / Math.max(otsu1, 1))); // target 135, tidak over-boost skin ke atas thresh
        for (let i = 0; i < total; i++)
            gray[i] = Math.max(0, Math.min(255, gray[i] * expFactor));
        snap('2. Auto Exposure', gray);

        // STAGE 3: Smart Gamma Correction (adaptive per image brightness)
        let bSum = 0;
        for (let i = 0; i < total; i++) bSum += gray[i];
        const mean = bSum / total;
        analytics.brightnessAverage = +mean.toFixed(1);
        // Gamma always >= 1.0 = always lightens. Never darken (no 0.88 / 0.72)
        let gamma;
        if (mean < 55) gamma = 2.2;
        else if (mean < 85) gamma = 1.8;
        else if (mean < 115) gamma = 1.45;
        else if (mean < 145) gamma = 1.2;
        else gamma = 1.05; // still slightly lighten even bright images
        analytics.gammaUsed = gamma;
        const invG = 1 / gamma;
        for (let i = 0; i < total; i++)
            gray[i] = Math.pow(Math.max(0, gray[i]) / 255, invG) * 255;
        snap('3. Smart Gamma', gray);

        // STAGE 4: Shadow Recovery â€” lift dark tones 15-22%
        for (let i = 0; i < total; i++) {
            if (gray[i] < 130) {
                const t = gray[i] / 130;
                gray[i] = gray[i] + (1 - t) * gray[i] * 0.22;
            }
        }
        snap('4. Shadow Recovery', gray);

        // STAGE 5: CLAHE 8x8, clipLimit=2.0
        this.applyCLAHE(gray, W, H, 8, 8, 1.2); // clip 1.2 (was 2.0) â†’ less aggressive shadow darkening
        snap('5. CLAHE', gray);

        // STAGE 6: Face-Priority Local Enhancement
        this.facePriorityEnhancement(gray, W, H, faceBoxes);
        snap('6. Face Enhancement', gray);

        // Stage 7 & 8 (local contrast + sharpen) REMOVED â€” unsharp mask crushes shadows darker
        // which is the main cause of overly dark prints.

        // STAGE 9: Highlight Guard â€” compress >220 to avoid paper-white blowout
        for (let i = 0; i < total; i++) {
            if (gray[i] > 220) gray[i] = 220 + (gray[i] - 220) * 0.6;
        }
        snap('9. Highlight Guard', gray);

        // STAGE 9.5: Brightness Multiplier â€” langsung skala nilai pixel
        // brightness=0   â†’ scale=0.5 â†’ sangat gelap
        // brightness=50  â†’ scale=1.75 â†’ normal
        // brightness=100 â†’ scale=3.0  â†’ sangat terang (dark skin 86*3=258â†’255 = putih)
        const brightScale = 0.5 + (this.printBrightness / 100) * 2.5;
        console.log('[Thermal Stage 9.5] printBrightness=' + this.printBrightness + ' brightScale=' + brightScale.toFixed(2));
        for (let i = 0; i < total; i++) {
            gray[i] = Math.min(255, gray[i] * brightScale);
        }
        snap('9.5 Brightness', gray);

        // STAGE 9.6: Contrast â€” memperkuat/melemahkan rentang gelap-terang
        if (this.printContrast !== 50) {
            // contrast 0-100 â†’ factor 0.3x (flat) ke 2.0x (ekstrem), 50 = 1.0 (netral)
            const cFactor = 0.3 + (this.printContrast / 100) * 1.7; // 0â†’0.3, 50â†’1.15, 100â†’2.0
            let cSum = 0;
            for (let i = 0; i < total; i++) cSum += gray[i];
            const cMid = cSum / total; // midpoint
            for (let i = 0; i < total; i++)
                gray[i] = Math.max(0, Math.min(255, cMid + (gray[i] - cMid) * cFactor));
            snap('9.6 Contrast', gray);
        }

        // STAGE 9.7: Sharpness (unsharp mask) â€” kejelasan tepi/detail
        if (this.printSharpness > 0) {
            const sharpAmt = (this.printSharpness / 100) * 1.2; // 0â†’0, 100â†’1.2
            const sb = this.fastBoxBlur(gray, W, H, 1);
            for (let i = 0; i < total; i++)
                gray[i] = Math.max(0, Math.min(255, gray[i] + (gray[i] - sb[i]) * sharpAmt));
            snap('9.7 Sharpness', gray);
        }

        // STAGE 10: Fixed threshold = 128 (standar halftone)
        // Pixel < 128 = titik hitam (dicetak)
        // Pixel >= 128 = putih (tidak dicetak)
        // Brightness slider mengontrol nilai pixel (Stage 9.5), bukan threshold ini.
        let thresh = 128;
        let bk = 0;
        for (let i = 0; i < total; i++) if (gray[i] < thresh) bk++;
        analytics.blackPixelRatio = +((bk / total) * 100).toFixed(1);
        analytics.whitePixelRatio = +(((total - bk) / total) * 100).toFixed(1);
        analytics.contrastLevel = thresh;
        console.log('[Thermal] brightness=' + this.printBrightness + ' scale=' + brightScale.toFixed(2) + ' thresh=128 black=' + analytics.blackPixelRatio + '%');

        if (debug) {
            const hist = new Uint32Array(256);
            for (let i = 0; i < total; i++)
                hist[Math.round(Math.max(0, Math.min(255, gray[i])))]++;
            analytics.histogram = Array.from(hist);
        }
        snap('10. Pre-Dither', gray);

        // STAGE 11: Dithering (bw_premium uses smooth S-curve instead of binary dither)
        if (mode === 'bw_premium') {
            // Linear bright mapping â€” no S-curve that crushes midtones
            for (let i = 0; i < total; i++) {
                // Map 0..255 â†’ 30..255 (floor blacks at 30, no ceiling crush)
                const v = Math.max(0, Math.min(255, gray[i] * (225 / 255) + 30));
                pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = v;
                pixels[i * 4 + 3] = 255;
            }
        } else {
            switch (ditherType) {
                case 'atkinson': this.atkinsonDither(gray, pixels, thresh, W, H); break;
                case 'jarvis': this.jarvisDither(gray, pixels, thresh, W, H); break;
                default: this.atkinsonDither(gray, pixels, thresh, W, H); // atkinson = cleaner portrait halftone
            }
        }

        if (debug) {
            const post = new Float32Array(total);
            for (let i = 0; i < total; i++) post[i] = pixels[i * 4];
            snap('11. Dithered Output', post);
        }

        const analysis = this.thermalQualityAnalysis(gray, total, analytics);
        if (debug && window.dispatchThermalDebug) window.dispatchThermalDebug(debugSteps, analysis);
        return imgData;
    }

    // â”€â”€â”€ Otsu Threshold â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    computeOtsu(gray) {
        const hist = new Int32Array(256);
        for (let i = 0; i < gray.length; i++)
            hist[Math.max(0, Math.min(255, Math.floor(gray[i])))]++;
        const N = gray.length;
        let sum = 0;
        for (let i = 0; i < 256; i++) sum += i * hist[i];
        let sumB = 0, wB = 0, varMax = 0, thresh = 128;
        for (let i = 0; i < 256; i++) {
            wB += hist[i]; if (!wB) continue;
            const wF = N - wB; if (!wF) break;
            sumB += i * hist[i];
            const mB = sumB / wB, mF = (sum - sumB) / wF;
            const v = wB * wF * (mB - mF) * (mB - mF);
            if (v > varMax) { varMax = v; thresh = i; }
        }
        return thresh;
    }

    // â”€â”€â”€ CLAHE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    applyCLAHE(gray, W, H, gX, gY, clip) {
        const tW = Math.ceil(W / gX), tH = Math.ceil(H / gY);
        const tiles = [];
        for (let ty = 0; ty < gY; ty++) {
            for (let tx = 0; tx < gX; tx++) {
                const x0 = tx * tW, y0 = ty * tH, x1 = Math.min(x0 + tW, W), y1 = Math.min(y0 + tH, H);
                const hist = new Float64Array(256);
                for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++)
                    hist[Math.max(0, Math.min(255, Math.floor(gray[y * W + x])))]++;
                const maxBin = clip * (x1 - x0) * (y1 - y0) / 256;
                let excess = 0;
                for (let i = 0; i < 256; i++) { if (hist[i] > maxBin) { excess += hist[i] - maxBin; hist[i] = maxBin; } }
                const inc = excess / 256;
                for (let i = 0; i < 256; i++) hist[i] += inc;
                const cdf = new Float64Array(256); cdf[0] = hist[0];
                for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + hist[i];
                const cMin = cdf.find(v => v > 0) || 0, sc = 255 / Math.max(1, cdf[255] - cMin);
                const lut = new Uint8Array(256);
                for (let i = 0; i < 256; i++) lut[i] = Math.round(Math.max(0, cdf[i] - cMin) * sc);
                tiles.push({ lut });
            }
        }
        for (let y = 0; y < H; y++) {
            const tyf = (y / tH) - 0.5, ty0 = Math.max(0, Math.min(gY - 1, Math.floor(tyf)));
            const ty1 = Math.min(gY - 1, ty0 + 1), tyR = Math.max(0, tyf - ty0);
            for (let x = 0; x < W; x++) {
                const txf = (x / tW) - 0.5, tx0 = Math.max(0, Math.min(gX - 1, Math.floor(txf)));
                const tx1 = Math.min(gX - 1, tx0 + 1), txR = Math.max(0, txf - tx0);
                const idx = y * W + x, v = Math.max(0, Math.min(255, Math.floor(gray[idx])));
                gray[idx] = tiles[ty0 * gX + tx0].lut[v] * (1 - txR) * (1 - tyR)
                    + tiles[ty0 * gX + tx1].lut[v] * txR * (1 - tyR)
                    + tiles[ty1 * gX + tx0].lut[v] * (1 - txR) * tyR
                    + tiles[ty1 * gX + tx1].lut[v] * txR * tyR;
            }
        }
    }

    // â”€â”€â”€ Face Priority Enhancement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    facePriorityEnhancement(gray, W, H, faceBoxes) {
        const regions = (faceBoxes && faceBoxes.length)
            ? faceBoxes.map(b => ({
                x0: Math.max(0, Math.floor(b.x)), y0: Math.max(0, Math.floor(b.y)),
                x1: Math.min(W, Math.floor(b.x + b.width)), y1: Math.min(H, Math.floor(b.y + b.height))
            }))
            : [{ x0: Math.floor(W * 0.15), y0: Math.floor(H * 0.08), x1: Math.floor(W * 0.85), y1: Math.floor(H * 0.92) }];
        regions.forEach(r => {
            let rSum = 0, rCount = 0;
            for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) { rSum += gray[y * W + x]; rCount++; }
            const rMean = rSum / Math.max(1, rCount);
            for (let y = r.y0; y < r.y1; y++) {
                for (let x = r.x0; x < r.x1; x++) {
                    const i = y * W + x;
                    if (gray[i] < rMean) gray[i] += (rMean - gray[i]) * 0.18;
                    gray[i] = Math.max(0, Math.min(255, (gray[i] - rMean) * 1.12 + rMean));
                }
            }
        });
    }

    // â”€â”€â”€ Fast Separable Box Blur â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    fastBoxBlur(gray, W, H, r) {
        const temp = new Float32Array(gray.length), out = new Float32Array(gray.length);
        const d = r * 2 + 1;
        for (let y = 0; y < H; y++) {
            const row = y * W; let s = 0;
            for (let x = 0; x < Math.min(d, W); x++) s += gray[row + x];
            for (let x = 0; x < W; x++) {
                temp[row + x] = s / Math.min(d, W);
                if (x + r + 1 < W) s += gray[row + x + r + 1];
                if (x - r >= 0) s -= gray[row + x - r];
            }
        }
        for (let x = 0; x < W; x++) {
            let s = 0;
            for (let y = 0; y < Math.min(d, H); y++) s += temp[y * W + x];
            for (let y = 0; y < H; y++) {
                out[y * W + x] = s / Math.min(d, H);
                if (y + r + 1 < H) s += temp[(y + r + 1) * W + x];
                if (y - r >= 0) s -= temp[(y - r) * W + x];
            }
        }
        return out;
    }

    // â”€â”€â”€ Floyd-Steinberg Dithering (default â€” best face gradation) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    floydSteinbergDither(gray, out, thresh, W, H) {
        const g = new Float32Array(gray);
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const i = y * W + x, nw = g[i] < thresh ? 0 : 255, err = g[i] - nw, o = i * 4;
                out[o] = out[o + 1] = out[o + 2] = nw; out[o + 3] = 255;
                if (x + 1 < W) g[i + 1] += err * 7 / 16;
                if (y + 1 < H) {
                    if (x > 0) g[i + W - 1] += err * 3 / 16;
                    g[i + W] += err * 5 / 16;
                    if (x + 1 < W) g[i + W + 1] += err * 1 / 16;
                }
            }
        }
    }

    // â”€â”€â”€ Atkinson Dithering â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    atkinsonDither(gray, out, thresh, W, H) {
        const g = new Float32Array(gray);
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const i = y * W + x, nw = g[i] < thresh ? 0 : 255, err = (g[i] - nw) / 8, o = i * 4;
                out[o] = out[o + 1] = out[o + 2] = nw; out[o + 3] = 255;
                if (x + 1 < W) g[i + 1] += err;
                if (x + 2 < W) g[i + 2] += err;
                if (y + 1 < H) { if (x > 0) g[i + W - 1] += err; g[i + W] += err; if (x + 1 < W) g[i + W + 1] += err; }
                if (y + 2 < H) g[i + W * 2] += err;
            }
        }
    }

    // â”€â”€â”€ Jarvis-Judice-Ninke Dithering â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    jarvisDither(gray, out, thresh, W, H) {
        const g = new Float32Array(gray);
        const mx = [[0, 0, 0, 7, 5], [3, 5, 7, 5, 3], [1, 3, 5, 3, 1]];
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const i = y * W + x, nw = g[i] < thresh ? 0 : 255, err = g[i] - nw, o = i * 4;
                out[o] = out[o + 1] = out[o + 2] = nw; out[o + 3] = 255;
                for (let ky = 0; ky < 3; ky++) for (let kx = -2; kx <= 2; kx++) {
                    const w = mx[ky][kx + 2]; if (!w) continue;
                    const ny = y + ky, nx = x + kx;
                    if (ny < H && nx >= 0 && nx < W) g[ny * W + nx] += err * w / 48;
                }
            }
        }
    }

    // â”€â”€â”€ Bayer 4x4 Ordered Dithering (titik lebih rapat dari 8x8) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // 4x4 matrix: cell 4px Ã— 4px = 0.5mm di 203 DPI (8x8 = 1mm â†’ terlalu rengang)
    // 17 tonal levels. Pre-blur di pipeline sudah kompensasi banding.
    bayerDither(gray, out, W, H) {
        const B = [
            [0, 8, 2, 10],
            [12, 4, 14, 6],
            [3, 11, 1, 9],
            [15, 7, 13, 5]
        ];
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const i = y * W + x;
                const o = i * 4;
                // 4x4: 16 nilai (0-15), dinormalisasi ke 0-255
                const bThresh = (B[y & 3][x & 3] + 0.5) / 16 * 255;
                const nw = gray[i] >= bThresh ? 255 : 0;
                out[o] = out[o + 1] = out[o + 2] = nw;
                out[o + 3] = 255;
            }
        }
    }

    // â”€â”€â”€ Thermal Quality Analysis (debug panel data) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    thermalQualityAnalysis(gray, total, analytics = {}) {
        let black = 0, white = 0, mid = 0;
        for (let i = 0; i < total; i++) {
            const v = gray[i];
            if (v < 40) black++; else if (v > 215) white++; else mid++;
        }
        const W = this.width, H = this.height;
        const blackRatio = (black / total) * 100, whiteRatio = (white / total) * 100, midtoneRatio = (mid / total) * 100;
        let contrast = 0;
        for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
            const c = gray[y * W + x];
            const lap = 4 * c - gray[(y - 1) * W + x] - gray[(y + 1) * W + x] - gray[y * W + x - 1] - gray[y * W + x + 1];
            contrast += lap * lap;
        }
        const contrastScore = Math.sqrt(contrast / ((W - 2) * (H - 2)));
        const fx0 = Math.floor(W * 0.2), fy0 = Math.floor(H * 0.1), fW = Math.floor(W * 0.6), fH = Math.floor(H * 0.8);
        let fS = 0, fV = 0;
        for (let y = fy0; y < fy0 + fH; y++) for (let x = fx0; x < fx0 + fW; x++) { fS++; if (gray[y * W + x] > 40) fV++; }
        const faceVisibility = (fV / Math.max(1, fS)) * 100;
        const printQuality = contrastScore > 80 ? 'Excellent' : contrastScore > 50 ? 'Good' : 'Fair';
        const warnings = [];
        if (blackRatio > 55) warnings.push('Too dark â€” lift shadows');
        if (whiteRatio > 75) warnings.push('Overexposed â€” compress highlights');
        if (faceVisibility < 50) warnings.push('Face detail may be lost');
        return {
            ...analytics,
            blackRatio: +blackRatio.toFixed(1), whiteRatio: +whiteRatio.toFixed(1),
            midtoneRatio: +midtoneRatio.toFixed(1), contrastScore: +contrastScore.toFixed(1),
            faceVisibility: +faceVisibility.toFixed(1), printQuality, warning: warnings.join(' | ')
        };
    }

    /** Preview hitam putih â€” grayscale halus tanpa dither (hanya untuk tampilan layar) */
    _applyBwPreview(imgData) {
        const pixels = imgData.data;
        const total = imgData.width * imgData.height;
        for (let i = 0; i < total; i++) {
            const o = i * 4;
            const g = pixels[o] * 0.299 + pixels[o + 1] * 0.587 + pixels[o + 2] * 0.114;
            const v = Math.max(0, Math.min(255, g * (225 / 255) + 30));
            pixels[o] = pixels[o + 1] = pixels[o + 2] = v;
            pixels[o + 3] = 255;
        }
        return imgData;
    }
}

class ThermalPrinter {
    constructor() {
        // Bluetooth
        this.device = null;
        this.server = null;
        this.characteristic = null;

        // Web Serial (USB-to-Serial adapters)
        this.port = null;

        // WebUSB (USB Printer Class â€” usblp)
        this.usbDevice = null;
        this.usbEndpointOut = null;
        this.usbInterface = null;

        this.connectionType = null; // 'bluetooth' | 'usb' | 'usb-direct'

        this.processor = new ThermalProcessor();
        this.printQuality = 'high';
        this.printWidth = 'auto';
        this.previewStyle = 'color';
    }

    async connectBluetooth() {
        try {
            if (typeof navigator === 'undefined' || !navigator.bluetooth || !navigator.bluetooth.requestDevice) {
                const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
                if (isIOS) {
                    alert(
                        '⚠️ Browser Safari / Chrome di iOS tidak mendukung Web Bluetooth bawaan (kebijakan Apple WebKit).\n\n' +
                        'Solusi cetak Bluetooth di iPhone / iPad:\n' +
                        '1. Buka web ini menggunakan browser "Bluefy - Web BLE Browser" (Download gratis di App Store) untuk cetak langsung via Bluetooth, ATAU\n' +
                        '2. Gunakan tombol "Simpan Gambar Struk" lalu cetak via aplikasi printer Bluetooth Anda (WalkPrint, Tiny Print, POS-Printer, dll).'
                    );
                } else {
                    const isMac = typeof navigator !== 'undefined' && /Macintosh|Mac OS X/.test(navigator.userAgent);
                    alert(
                        isMac
                            ? '⚠️ Browser ini (misal Safari) tidak mendukung Web Bluetooth di Mac.\n\n' +
                            'Solusi di Mac:\n' +
                            '1. Buka web ini menggunakan Google Chrome atau Microsoft Edge di Mac (mendukung Bluetooth langsung), ATAU\n' +
                            '2. Gunakan tombol "Cetak (PC / Web)" untuk cetak via dialog cetak bawaan macOS.'
                            : '⚠️ Web Bluetooth tidak didukung di browser ini.\n' +
                            'Silakan gunakan Google Chrome atau Microsoft Edge di PC / Mac / Android.'
                    );
                }
                return false;
            }

            this.device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: [
                    '000018f0-0000-1000-8000-00805f9b34fb',
                    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
                    'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
                ]
            });
            this.device.addEventListener('gattserverdisconnected', this.onDisconnected.bind(this));
            this.server = await this.device.gatt.connect();
            const services = await this.server.getPrimaryServices();
            for (const service of services) {
                const characteristics = await service.getCharacteristics();
                for (const characteristic of characteristics) {
                    if (characteristic.properties.write || characteristic.properties.writeWithoutResponse) {
                        this.characteristic = characteristic;
                        break;
                    }
                }
                if (this.characteristic) break;
            }
            if (!this.characteristic) throw new Error('Could not find writable characteristic');
            this.connectionType = 'bluetooth';
            return true;
        } catch (error) {
            console.error(error);
            if (error.name !== 'NotFoundError') {
                const isMac = typeof navigator !== 'undefined' && /Macintosh|Mac OS X/.test(navigator.userAgent);
                if (isMac && (error.message?.includes('Unsupported device') || error.name === 'NotSupportedError')) {
                    alert(
                        '⚠️ Printer thermal ini menggunakan Bluetooth Classic (SPP), sedangkan Web Bluetooth di Mac hanya mendukung BLE (Bluetooth Low Energy).\n\n' +
                        '✅ Solusi di Mac:\n' +
                        '1. Klik tombol "Cetak (PC / Web)" untuk cetak melalui driver/dialog sistem macOS (paling stabil & mudah).\n' +
                        '2. Atau gunakan kabel USB dan klik tombol "Cetak (Kabel USB / Serial)".'
                    );
                } else {
                    alert('Bluetooth Connection Failed: ' + error.message);
                }
            }
            return false;
        }
    }

    // â”€â”€â”€ WebUSB: untuk printer USB Printer Class (usblp / bInterfaceClass=7) â”€â”€
    // Printer YICHIP/GDMicro (VID=0x28E9) menggunakan USB Printer Class,
    // bukan USB-to-Serial â€” tidak muncul di Web Serial picker.
    // WebUSB bypass driver kernel dan akses bulk OUT endpoint langsung.
    async connectUSBDirect() {
        try {
            if (!navigator.usb) {
                const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
                alert(isSecure
                    ? 'âŒ WebUSB tidak didukung browser ini.\nGunakan Google Chrome atau Edge.'
                    : 'âŒ WebUSB membutuhkan HTTPS.\nAkses via https:// atau localhost.');
                return false;
            }

            // Jika sudah terkoneksi di sesi ini, langsung return true
            if (this.connectionType === 'usb-direct' && this.usbDevice && this.usbDevice.opened) {
                console.log('[USB-Direct] Already connected, reusing existing connection');
                return true;
            }

            // Tampilkan picker WebUSB â€” filter ke printer yang dikenal
            let usbDev;
            try {
                usbDev = await navigator.usb.requestDevice({
                    filters: [
                        { vendorId: 0x28E9 },  // GDMicroelectronics / YICHIP
                        { classCode: 7 }        // USB Printer Class
                    ]
                });
            } catch (e) {
                if (e.name === 'NotFoundError') return false; // user cancel
                throw e;
            }

            // Buka device jika belum terbuka
            if (!usbDev.opened) {
                await usbDev.open();
            }

            // Pilih konfigurasi pertama jika belum terpilih
            if (usbDev.configuration === null) {
                await usbDev.selectConfiguration(1);
            }

            // Temukan interface USB Printer Class (classCode=7)
            let iface = null;
            for (const cfg of usbDev.configurations) {
                for (const i of cfg.interfaces) {
                    const alt = i.alternates[0];
                    if (alt && (alt.interfaceClass === 7 || alt.interfaceClass === 0xFF)) {
                        iface = i; break;
                    }
                }
                if (iface) break;
            }
            if (!iface) iface = usbDev.configuration.interfaces[0];

            // Claim interface â€” toleransi jika sudah di-claim oleh konteks ini
            try {
                await usbDev.claimInterface(iface.interfaceNumber);
            } catch (claimErr) {
                if (claimErr.message && claimErr.message.includes('already claimed')) {
                    console.log('[USB-Direct] Interface already claimed by this context, continuing...');
                } else {
                    await usbDev.close().catch(() => { });
                    const isKernelIssue = claimErr.message && claimErr.message.includes('Unable to claim');
                    if (isKernelIssue) {
                        alert(
                            'âš ï¸ Printer USB terdeteksi tapi tidak bisa diakses.\n\n' +
                            'Driver sistem masih menahan printer ini.\n\n' +
                            'âœ… Langkah:\n' +
                            '1. Cabut kabel USB printer\n' +
                            '2. Tunggu 2 detik\n' +
                            '3. Colok kembali\n' +
                            '4. Klik tombol "Kabel USB" lagi\n\n' +
                            '(Jangan klik OK sebelum colok ulang)'
                        );
                    } else {
                        alert('âŒ Gagal claim interface: ' + claimErr.message);
                    }
                    return false;
                }
            }

            // Temukan endpoint Bulk OUT
            let epOut = null;
            for (const ep of iface.alternates[0].endpoints) {
                if (ep.direction === 'out' && ep.type === 'bulk') { epOut = ep; break; }
            }
            if (!epOut) {
                await usbDev.close().catch(() => { });
                alert('âŒ Tidak menemukan endpoint OUT pada printer.\nPastikan printer mendukung ESC/POS via USB.');
                return false;
            }

            this.usbDevice = usbDev;
            this.usbInterface = iface;
            this.usbEndpointOut = epOut;
            this.connectionType = 'usb-direct';

            // Release device saat tab ditutup/navigasi agar tab lain bisa connect
            if (!this._unloadRegistered) {
                this._unloadRegistered = true;
                window.addEventListener('beforeunload', () => { this.disconnect(); });
                window.addEventListener('pagehide', () => { this.disconnect(); });
            }

            navigator.usb.addEventListener('disconnect', (event) => {
                if (event.device === this.usbDevice) this.onDisconnected();
            });

            console.log('[USB-Direct] Connected:', usbDev.productName, '| EP OUT:', epOut.endpointNumber);
            return true;
        } catch (error) {
            console.error('[USB-Direct] Error:', error);
            if (error.name === 'NotFoundError') {
                // User cancel di dialog â€” tidak perlu alert
                return false;
            }
            if (error.name === 'NotAllowedError' || (error.message && error.message.includes('user gesture'))) {
                // Biasanya terjadi jika browser masih cache printer.js lama (via Service Worker)
                // Hard-refresh (Ctrl+Shift+R) memaksa browser load versi terbaru
                alert(
                    'âš ï¸ Browser memblokir akses USB.\n\n' +
                    'Kemungkinan Service Worker masih cache file lama.\n\n' +
                    'âœ… Solusi: tekan Ctrl+Shift+R (Hard Refresh)\n' +
                    'lalu coba klik Kabel USB lagi.'
                );
                return false;
            }
            alert('USB Direct Connection Failed: ' + error.message);
            return false;
        }
    }

    // Release USB device secara eksplisit (saat navigasi / tab ditutup)
    disconnect() {
        if (this.connectionType === 'usb-direct' && this.usbDevice) {
            try {
                this.usbDevice.releaseInterface(this.usbInterface.interfaceNumber).catch(() => { });
                this.usbDevice.close().catch(() => { });
            } catch (e) { /* ignore */ }
        }
        this.onDisconnected();
    }

    // â”€â”€â”€ Web Serial: untuk printer yang pakai USB-to-Serial adapter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    async connectUSB() {
        try {
            if (!navigator.serial) {
                const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
                alert(isSecure
                    ? 'âŒ Web Serial tidak didukung browser ini.\nGunakan Google Chrome atau Edge.'
                    : 'âŒ Web Serial membutuhkan HTTPS.\nAkses via https:// atau localhost.');
                return false;
            }
            this.port = await navigator.serial.requestPort();
            try {
                await this.port.open({ baudRate: 9600 });
            } catch (e) {
                if (e.name !== 'InvalidStateError' && (!e.message || !e.message.includes('already open'))) throw e;
                console.log('Port was already open, continuing...');
            }
            this.connectionType = 'usb';
            navigator.serial.addEventListener('disconnect', (event) => {
                if (event.target === this.port) this.onDisconnected();
            });
            console.log('[Serial] Connected to USB Serial Printer');
            return true;
        } catch (error) {
            console.error(error);
            if (error.name !== 'NotFoundError') {
                alert('USB Serial Connection Failed: ' + error.message);
            }
            return false;
        }
    }

    // Selalu tampilkan modal pilihan koneksi
    async connect() {
        // Disconnect koneksi lama sebelum ganti ke koneksi baru
        // Ini penting saat switch dari BT â†’ USB atau sebaliknya
        if (this.connectionType) {
            console.log('[Connect] Disconnecting previous:', this.connectionType);
            this.disconnect();
        }

        return new Promise((resolve) => {
            const modal = document.getElementById('printer-modal');

            const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
            const usbDirectOk = !!navigator.usb && isSecure;
            const serialOk = !!navigator.serial && isSecure;

            if (!modal) {
                if (usbDirectOk) {
                    this.connectUSBDirect().then(resolve);
                } else {
                    this.connectBluetooth().then(resolve);
                }
                return;
            }

            const btnUsb = document.getElementById('btn-print-usb');
            const btnBt = document.getElementById('btn-print-bt');
            const btnCancel = document.getElementById('btn-print-cancel');

            const oldNote = modal.querySelector('#usb-unavailable-note');
            if (oldNote) oldNote.remove();

            if (usbDirectOk) {
                btnUsb.disabled = false;
                btnUsb.style.opacity = '';
                btnUsb.style.cursor = '';
                btnUsb.innerHTML = '<i class="fa-brands fa-usb" style="margin-right:8px;"></i> Kabel USB';
                btnUsb.title = 'Hubungkan via WebUSB';
            } else if (serialOk) {
                btnUsb.disabled = false;
                btnUsb.style.opacity = '';
                btnUsb.style.cursor = '';
                btnUsb.innerHTML = '<i class="fa-brands fa-usb" style="margin-right:8px;"></i> Kabel USB (Serial)';
                btnUsb.title = 'Hubungkan via Web Serial';
            } else {
                btnUsb.disabled = true;
                btnUsb.style.opacity = '0.45';
                btnUsb.style.cursor = 'not-allowed';
                btnUsb.innerHTML = '<i class="fa-brands fa-usb" style="margin-right:8px;"></i> Kabel USB';
                const usbNote = document.createElement('p');
                usbNote.id = 'usb-unavailable-note';
                usbNote.style.cssText = 'font-size:0.8rem; color:#e55; margin:-0.5rem 0 0; text-align:center;';
                usbNote.textContent = !isSecure ? 'âš ï¸ USB membutuhkan HTTPS' : 'âš ï¸ Gunakan Chrome/Edge untuk USB';
                btnUsb.parentNode.insertBefore(usbNote, btnUsb.nextSibling);
            }

            modal.style.display = 'flex';

            const cleanup = () => {
                modal.style.display = 'none';
                btnUsb.onclick = null;
                btnBt.onclick = null;
                btnCancel.onclick = null;
                btnUsb.disabled = false;
                btnUsb.style.opacity = '';
                btnUsb.style.cursor = '';
            };

            btnUsb.onclick = () => {
                cleanup();
                if (usbDirectOk) {
                    this.connectUSBDirect().then(resolve);
                } else {
                    this.connectUSB().then(resolve);
                }
            };

            btnBt.onclick = () => {
                cleanup();
                this.connectBluetooth().then(resolve);
            };

            btnCancel.onclick = () => {
                cleanup();
                resolve(false);
            };
        });
    }

    async autoConnect() {
        // 1. Prioritas: WebUSB (untuk printer USB Printer Class seperti YICHIP/GDMicro)
        //    navigator.usb.getDevices() hanya mengembalikan device yang sudah pernah diizinkan user
        if (navigator.usb && navigator.usb.getDevices) {
            try {
                const usbDevices = await navigator.usb.getDevices();
                for (const usbDev of usbDevices) {
                    try {
                        await usbDev.open();
                        if (usbDev.configuration === null) await usbDev.selectConfiguration(1);

                        // Cari interface printer class
                        let iface = null;
                        for (const cfg of usbDev.configurations) {
                            for (const i of cfg.interfaces) {
                                const alt = i.alternates[0];
                                if (alt && (alt.interfaceClass === 7 || alt.interfaceClass === 0xFF)) {
                                    iface = i; break;
                                }
                            }
                            if (iface) break;
                        }
                        if (!iface) iface = usbDev.configuration.interfaces[0];

                        await usbDev.claimInterface(iface.interfaceNumber);

                        // Cari endpoint Bulk OUT
                        let epOut = null;
                        for (const ep of iface.alternates[0].endpoints) {
                            if (ep.direction === 'out' && ep.type === 'bulk') { epOut = ep; break; }
                        }
                        if (!epOut) { await usbDev.close(); continue; }

                        this.usbDevice = usbDev;
                        this.usbInterface = iface;
                        this.usbEndpointOut = epOut;
                        this.connectionType = 'usb-direct';
                        console.log('[AutoConnect] WebUSB:', usbDev.productName);
                        return true;
                    } catch (e) {
                        console.log('[AutoConnect] WebUSB device failed:', e.message);
                    }
                }
            } catch (err) {
                console.log('[AutoConnect] WebUSB getDevices failed:', err);
            }
        }

        // 2. Web Serial (USB-to-Serial adapter)
        if (navigator.serial && navigator.serial.getPorts) {
            try {
                const ports = await navigator.serial.getPorts();
                for (const port of ports) {
                    try {
                        try {
                            await port.open({ baudRate: 9600 });
                        } catch (e) {
                            if (e.name !== 'InvalidStateError' && (!e.message || !e.message.includes('already open'))) throw e;
                        }
                        this.port = port;
                        this.connectionType = 'usb';
                        console.log('[AutoConnect] Web Serial connected');
                        return true;
                    } catch (e) {
                        console.log('[AutoConnect] Serial port failed:', e.message);
                    }
                }
            } catch (error) {
                console.log('[AutoConnect] getPorts failed:', error);
            }
        }

        // 3. Bluetooth â€” hanya jika ada adapter BT
        if (navigator.bluetooth && navigator.bluetooth.getDevices) {
            // Cek apakah BT adapter tersedia sebelum coba connect
            const btAvailable = navigator.bluetooth.getAvailability
                ? await navigator.bluetooth.getAvailability().catch(() => false)
                : true; // jika getAvailability tidak ada, asumsikan tersedia
            if (!btAvailable) {
                console.log('[AutoConnect] No Bluetooth adapter, skipping BT');
            } else
                try {
                    const devices = await navigator.bluetooth.getDevices();
                    for (const device of devices) {
                        try {
                            this.device = device;
                            this.device.addEventListener('gattserverdisconnected', this.onDisconnected.bind(this));
                            this.server = await this.device.gatt.connect();
                            const services = await this.server.getPrimaryServices();
                            for (const service of services) {
                                const characteristics = await service.getCharacteristics();
                                for (const characteristic of characteristics) {
                                    if (characteristic.properties.write || characteristic.properties.writeWithoutResponse) {
                                        this.characteristic = characteristic;
                                        this.connectionType = 'bluetooth';
                                        console.log('[AutoConnect] Bluetooth:', device.name);
                                        return true;
                                    }
                                }
                            }
                        } catch (e) {
                            this.device = null; this.server = null; this.characteristic = null;
                            console.log('[AutoConnect] BT device failed:', device.name, e.message);
                        }
                    }
                } catch (error) {
                    console.log('[AutoConnect] getDevices failed:', error);
                }
        }
        return false;
    }

    onDisconnected() {
        console.log('Printer disconnected');
        this.device = null;
        this.server = null;
        this.characteristic = null;
        this.port = null;
        this.usbDevice = null;
        this.usbInterface = null;
        this.usbEndpointOut = null;
        this.connectionType = null;
    }

    async write(data) {
        if (this.connectionType === 'bluetooth') {
            if (!this.characteristic) return;
            const CHUNK_SIZE = 100;
            for (let i = 0; i < data.length; i += CHUNK_SIZE) {
                const chunk = data.slice(i, i + CHUNK_SIZE);
                try {
                    await this.characteristic.writeValue(new Uint8Array(chunk));
                } catch (e) {
                    console.warn('BT write retry...', e);
                    await new Promise(r => setTimeout(r, 50));
                    await this.characteristic.writeValue(new Uint8Array(chunk));
                }
                await new Promise(r => setTimeout(r, 25));
            }
        } else if (this.connectionType === 'usb') {
            // Web Serial (USB-to-Serial adapter)
            if (!this.port) return;
            const writer = this.port.writable.getWriter();
            try {
                const CHUNK_SIZE = 1024;
                for (let i = 0; i < data.length; i += CHUNK_SIZE) {
                    await writer.write(new Uint8Array(data.slice(i, i + CHUNK_SIZE)));
                    await new Promise(r => setTimeout(r, 10));
                }
            } finally {
                writer.releaseLock();
            }
        } else if (this.connectionType === 'usb-direct') {
            // WebUSB â€” kirim langsung ke bulk OUT endpoint
            if (!this.usbDevice || !this.usbEndpointOut) return;
            const CHUNK_SIZE = 16384; // 16 KB per transfer (bulk USB bisa besar)
            for (let i = 0; i < data.length; i += CHUNK_SIZE) {
                const chunk = new Uint8Array(data.slice(i, i + CHUNK_SIZE));
                const result = await this.usbDevice.transferOut(this.usbEndpointOut.endpointNumber, chunk);
                if (result.status !== 'ok') {
                    console.warn('[USB-Direct] transferOut status:', result.status);
                }
                await new Promise(r => setTimeout(r, 5));
            }
        }
    }

    async printImage(canvas) {
        if (!this.connectionType) {
            alert('Printer not connected!');
            return;
        }

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const imgData = ctx.getImageData(0, 0, width, height);

        // No global processing here, because the photos are already processed individually
        // before being drawn onto the canvas, keeping frames and text pristine.

        const commands = this.generateESCPOS(imgData.data, width, height);

        await this.write(commands);
    }

    simulatePrint(canvas) {
        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = canvas.width;
        previewCanvas.height = canvas.height;
        const ctx = previewCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, 0);

        const imgData = ctx.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
        this.processor.process(imgData, this.printQuality, this.previewStyle);
        ctx.putImageData(imgData, 0, 0);

        return previewCanvas.toDataURL('image/png');
    }

    simulatePrintOnContext(ctx, width, height) {
        const imgData = ctx.getImageData(0, 0, width, height);
        this.processor.process(imgData, this.printQuality, this.previewStyle);
        ctx.putImageData(imgData, 0, 0);
    }



    generateESCPOS(pixels, width, height) {
        let data = [0x1B, 0x40];
        data.push(0x1B, 0x61, 0x01);

        const byteWidth = Math.ceil(width / 8);
        data.push(0x1D, 0x76, 0x30, 0x00);
        data.push(byteWidth & 0xFF, (byteWidth >> 8) & 0xFF);
        data.push(height & 0xFF, (height >> 8) & 0xFF);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < byteWidth; x++) {
                let byte = 0;
                for (let b = 0; b < 8; b++) {
                    const px = x * 8 + b;
                    if (px < width) {
                        const idx = (y * width + px) * 4;
                        // Threshold 128: foto sudah ter-dither B&W oleh ThermalProcessor.
                        // Gunakan 128 standar agar pixel putih (255) tidak salah dicetak.
                        if (pixels[idx] < 128) {
                            byte |= (1 << (7 - b));
                        }
                    }
                }
                data.push(byte);
            }
        }

        data.push(0x1B, 0x64, 0x02); // Feed 2 lines (approx 8.5mm)
        data.push(0x1D, 0x56, 0x41, 0x00);

        return data;
    }
}

if (typeof window !== 'undefined') {
    window.ThermalPrinter = ThermalPrinter;
    window.ThermalProcessor = ThermalProcessor;
}

export { ThermalPrinter, ThermalProcessor };
