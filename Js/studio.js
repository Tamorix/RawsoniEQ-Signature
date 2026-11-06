
"use strict";

/*
 * RawsoniEQ Signature by TAMORIX
 * Studio interface controller
 */

class RawsoniStudio {
    constructor() {
        this.engine = null;
        this.audioElement = null;
        this.objectUrl = null;
        this.bandCount = 10;
        this.gains = new Array(10).fill(0);
        this.presets = {
            "Flat": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                   "Signature": [2, 4, -2, -5, -5, -2, -2, -3.5, -5, 2]
    };
    }
 

async downloadWav() {
    if (!this.engine || !this.audioElement) {
        alert("Please load an audio file before exporting.");
        return;
    }

    const file = this.currentFile;

    if (!file) {
        alert("Please import an audio file before exporting.");
        return;
    }

    try {
        this.message("Exporting WAV...");

        const wavBlob = await this.engine.exportWav(
            file,
            [...this.gains]
        );

        const downloadUrl = URL.createObjectURL(wavBlob);
        const link = document.createElement("a");

        link.href = downloadUrl;
        link.download =
            file.name.replace(/\.[^/.]+$/, "") + "_RawsoniEQ.wav";

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

        this.message("WAV export completed successfully.");
    } catch (error) {
        console.error("RawsoniEQ WAV download failed:", error);
        this.message(`WAV export failed: ${error.message}`);
        alert("WAV export failed. Check the console for details.");
    }
}


    start() {
        this.engine = new window.RawsoniAudioEngine();
        this.audioElement = document.createElement("audio");
        this.audioElement.preload = "auto";

        this.audioElement.addEventListener("ended", () => {
            this.updatePlaybackStatus("Playback finished");
        });

        this.audioElement.addEventListener("error", () => {
            this.updatePlaybackStatus("Unable to load this audio file");
        });

        this.renderStudio();
        this.renderSpatialPositioner();
    }

    renderStudio() {
        const studio = document.querySelector(".studio-placeholder");

        if (!studio) return;

        studio.className = "studio-interface";

        studio.innerHTML = `
            <div class="studio-toolbar">
                <label class="file-button">
                    Import Audio
                    <input id="audio-file" type="file"
                        accept="audio/*,.wav,.mp3,.ogg,.m4a,.flac">
                </label>

                <label class="mode-label">
                    EQ Mode
                 <select id="eq-mode">
    <option value="10">10 Bands</option>
    <option value="20">20 Bands</option>
    <option value="30">30 Bands</option>
</select>
                </label>

                <label class="mode-label">
                    Preset
                    <select id="eq-preset">
                        <option value="Flat">Flat</option>
                        <option value="Signature">RawsoniEQ Signature</option>
                        <option value="Custom">Custom</option>
                    </select>
                </label>
            </div>

            <div class="audio-file-info" id="audio-file-info">
                No audio loaded. Import an audio file to begin.
            </div>

            <div class="playback-controls">
                <button id="play-audio" disabled>▶ Play</button>
                <button id="pause-audio" disabled>Ⅱ Pause</button>
                <button id="stop-audio" disabled>■ Stop</button>
                <span id="playback-status" role="status">Ready</span>
            </div>

            <div class="audio-timeline">
                <span id="current-time">00:00</span>
                <input id="audio-seek" type="range"
                    min="0" max="100" value="0" disabled
                    aria-label="Seek audio">
                <span id="total-time">00:00</span>
            </div>

            <div class="eq-heading">
                <h3>10-Band Equalizer</h3>
                <button id="reset-eq">Reset EQ</button>
            </div>

            <div class="eq-bands" id="eq-bands"></div>

            <div class="studio-bottom">
                <label>
                    Master Volume
                    <input id="master-volume" type="range"
                        min="0" max="100" value="100">
                </label>

                <button id="save-preset">Save Custom Preset</button>
              <label class="mode-label">
    Export Format
    <select id="export-format">
        <option value="wav">WAV — Lossless PCM</option>
        <option value="mp3">MP3 — Compressed</option>
        <option value="flac">FLAC — Lossless</option>
        <option value="spatial">RawsoniEQ Spatial — Stereo</option>
<option value="surround61">6.1 Surround — 7 Channel WAV</option>
<option value="cinema61">6.1 Cinema Spatial — 7 Channel WAV</option>
    </select>
</label>

<label class="mode-label" id="spatial-mode-container" style="display: none;">
    Spatial Mode
    <select id="spatial-mode">
        <option value="3d">3D Spatial</option>
        <option value="cinema">Cinema Spatial</option>
    </select>
</label>

<button id="export-wav">Export Audio</button>
            </div>

            <p class="studio-message" id="studio-message" role="status">
                Studio interface loaded. Audio processing connection pending.
            </p>
<section class="spatial-studio" id="spatial-studio">
    <header class="spatial-header">
        <h2>RawsoniEQ Spatial Studio</h2>
        <p>Position your sound in 3D space.</p>
    </header>

    <section class="spatial-positioner">
        <h3>3D Sound Positioner</h3>
        <div class="spatial-positioner-view" id="spatial-positioner"></div>
    </section>
</section>
        `;

                this.bindInterface();
        this.renderBands();
        this.renderSpatialPositioner();
        this.updatePlaybackStatus("Import an audio file to begin");s
    }

    bindInterface() {
        document.getElementById("audio-file")
            .addEventListener("change", event => {
                this.loadAudio(event.target.files[0]);
            });

        document.getElementById("play-audio")
            .addEventListener("click", () => this.play());

        document.getElementById("pause-audio")
            .addEventListener("click", () => this.pause());

        document.getElementById("stop-audio")
            .addEventListener("click", () => this.stop());

       document.getElementById("eq-mode")
    .addEventListener("change", async event => {
        const count = Number(event.target.value);

        try {
            this.bandCount = count;

            if (this.engine && this.engine.isInitialized) {
                this.engine.setBandCount(count);
                this.gains = [...this.engine.gains];
            } else {
                const frequencies = this.engine.getFrequencies(count);
                this.gains = frequencies.map(() => 0);
            }

            this.renderBands();

            const heading = document.querySelector(".eq-heading h3");
            if (heading) {
                heading.textContent = `${count}-Band Equalizer`;
            }

            this.message(`${count}-band EQ selected.`);
        } catch (error) {
            event.target.value = String(this.bandCount || 10);
            this.message(`Could not change EQ mode: ${error.message}`);
        }
    });

        document.getElementById("eq-preset")
            .addEventListener("change", event => {
                const preset = this.presets[event.target.value];

                if (preset) this.applyPreset(preset);
            });

        document.getElementById("reset-eq")
            .addEventListener("click", () => this.applyPreset(this.presets.Flat));

        document.getElementById("master-volume")
            .addEventListener("input", event => {
                const volume = Number(event.target.value) / 100;

                if (this.audioElement) {
                    this.audioElement.volume = volume;
                }
            });

        document.getElementById("save-preset")
            .addEventListener("click", () => this.savePreset());
const exportFormat = document.getElementById("export-format");
const spatialModeContainer =
    document.getElementById("spatial-mode-container");
const spatialMode = document.getElementById("spatial-mode");

spatialMode.addEventListener("change", () => {
    console.log("Spatial mode selected:", spatialMode.value);
});

exportFormat.addEventListener("change", () => {
    spatialModeContainer.style.display =
        exportFormat.value === "spatial" ? "" : "none";
});
    
document.getElementById("export-wav")
    .addEventListener("click", async () => {
        const format = document.getElementById("export-format").value;

        if (format === "wav") {
            this.downloadWav();

        } else if (format === "mp3") {
            try {
                if (!this.currentFile) {
                    alert("Please load an audio file first.");
                    return;
                }

                this.message("Preparing MP3 export...");

               const mp3Blob = await this.engine.exportMp3(
    this.currentFile,
    [...this.gains],
    320
);

                const downloadUrl = URL.createObjectURL(mp3Blob);
                const link = document.createElement("a");

                link.href = downloadUrl;
                link.download = this.currentFile.name.replace(/\.[^/.]+$/, "") + "_RawsoniEQ.mp3";

                document.body.appendChild(link);
                link.click();
                link.remove();

                setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

                this.message("MP3 export completed successfully.");

            } catch (error) {
                console.error("MP3 export error:", error);
                this.message("MP3 export failed: " + error.message);
                alert("MP3 export failed: " + error.message);
            }

        } else if (format === "surround61") {
            try {
                if (!this.currentFile) {
                    alert("Please load an audio file first.");
                    return;
                }

                this.message("Preparing 6.1 Surround export...");

                const surroundBlob = await this.engine.exportSurround61(
                    this.currentFile,
                    [...this.gains]
                );

                const downloadUrl = URL.createObjectURL(surroundBlob);
                const link = document.createElement("a");

                link.href = downloadUrl;
                link.download = this.currentFile.name.replace(/\.[^/.]+$/, "") + "_RawsoniEQ_6.1_Surround.wav";

                document.body.appendChild(link);
                link.click();
                link.remove();

                setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

                this.message("6.1 Surround export completed successfully.");

            } catch (error) {
                console.error("6.1 Surround export error:", error);
                this.message("6.1 Surround export failed: " + error.message);
                alert("6.1 Surround export failed: " + error.message);
            }

        } else if (format === "cinema61") {
            try {
                if (!this.currentFile) {
                    alert("Please load an audio file first.");
                    return;
                }

                this.message("Preparing Cinema 6.1 Spatial export...");

                const cinemaBlob = await this.engine.exportCinema61(
                    this.currentFile,
                    [...this.gains]
                );

                const downloadUrl = URL.createObjectURL(cinemaBlob);
                const link = document.createElement("a");

                link.href = downloadUrl;
                link.download = this.currentFile.name.replace(/\.[^/.]+$/, "") + "_RawsoniEQ_Cinema_6.1.wav";

                document.body.appendChild(link);
                link.click();
                link.remove();

                setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

                this.message("Cinema 6.1 Spatial export completed successfully.");

            } catch (error) {
                console.error("Cinema 6.1 Spatial export error:", error);
                this.message("Cinema 6.1 Spatial export failed: " + error.message);
                alert("Cinema 6.1 Spatial export failed: " + error.message);
            }

               } else if (format === "flac") {
            try {
                if (!this.currentFile) {
                    alert("Please load an audio file first.");
                    return;
                }

                this.message("Preparing FLAC export...");

                const flacBlob = await this.engine.exportFlac(
                    this.currentFile,
                    [...this.gains]
                );

                const downloadUrl = URL.createObjectURL(flacBlob);
                const link = document.createElement("a");

                link.href = downloadUrl;
                link.download = this.currentFile.name.replace(/\.[^/.]+$/, "") + "_RawsoniEQ.flac";

                document.body.appendChild(link);
                link.click();
                link.remove();

                setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

                this.message("FLAC export completed successfully.");

            } catch (error) {
                console.error("FLAC export error:", error);
                this.message("FLAC export failed: " + error.message);
                alert("FLAC export failed: " + error.message);
            }

        } else {
            this.message(
                `${format.toUpperCase()} export is not implemented yet.`
            );
            alert(
                `${format.toUpperCase()} export is not ready yet. WAV export remains available.`
            );
        }
    });


document.getElementById("exportWavBtn")
    ?.addEventListener("click", () => this.downloadWav());

        document.getElementById("audio-seek")
            .addEventListener("input", event => {
                if (this.audioElement &&
                    Number.isFinite(this.audioElement.duration)) {
                    this.audioElement.currentTime =
                        this.audioElement.duration *
                        Number(event.target.value) / 100;
                }
            });

        this.audioElement.addEventListener("timeupdate", () => {
            const audio = this.audioElement;

            document.getElementById("current-time").textContent =
                this.formatTime(audio.currentTime);

            document.getElementById("audio-seek").value =
                audio.duration ? audio.currentTime / audio.duration * 100 : 0;
        });

        this.audioElement.addEventListener("loadedmetadata", () => {
            document.getElementById("total-time").textContent =
                this.formatTime(this.audioElement.duration);

            document.getElementById("audio-seek").disabled = false;
        });
    }

    renderBands() {
        const container = document.getElementById("eq-bands");
        if (!container) return;

        const frequencies = this.engine.bandFrequencies;

        container.innerHTML = frequencies.map((frequency, index) => `
            <div class="eq-band">
                <label for="eq-gain-${index}">
                    ${frequency >= 1000
    ? (frequency / 1000).toFixed(1).replace(/\.0$/, "") + "k"
    : Number.isInteger(frequency) ? frequency : frequency.toFixed(1)}
                    <span>Hz</span>
                </label>

                <output id="eq-value-${index}">0 dB</output>

                <input id="eq-gain-${index}" type="range"
                    min="-12" max="12" step="0.5" value="${this.gains[index]}"
                    aria-label="${frequency} Hz gain">

                <span class="eq-band-number">B${index + 1}</span>
            </div>
        `).join("");

        frequencies.forEach((frequency, index) => {
            document.getElementById(`eq-gain-${index}`)
                .addEventListener("input", event => {
                    
this.gains[index] = Number(event.target.value);

document.getElementById(`eq-value-${index}`)
    .textContent = `${this.gains[index]} dB`;

document.getElementById("eq-preset").value = "Custom";

if (this.engine && this.engine.isInitialized) {
    this.engine.setBandGain(index, this.gains[index]);
}

this.message(
    this.engine && this.engine.isInitialized
        ? "EQ gain applied to the audio engine."
        : "EQ gain saved. Audio engine connection is pending."
);
                });
        });
    }

    async loadAudio(file) {
        if (!file) return;
this.currentFile = file;

        if (!file.type.startsWith("audio/") &&
            !/\.(wav|mp3|ogg|m4a|flac|aac)$/i.test(file.name)) {
            this.message("Please select a supported audio file.");
            return;
        }

       
try {
    await this.engine.initialize();

    this.engine.setAllGains(this.gains);

    this.engine.loadAudioFile(file, this.audioElement);
    this.engine.connectAudioSource(this.audioElement);

    this.objectUrl = this.engine.objectURL;
} catch (error) {
    this.message(`Audio engine error: ${error.message}`);
    return;
}

        document.getElementById("audio-file-info").textContent = file.name;
        document.getElementById("play-audio").disabled = false;
        document.getElementById("pause-audio").disabled = false;
        document.getElementById("stop-audio").disabled = false;

        this.updatePlaybackStatus("Audio loaded");
        this.message(
            "Audio file loaded. EQ processing connection pending."
        );
    }
        
async play() {
    if (!this.audioElement.src) {
        this.message("Import an audio file first.");
        return;
    }

    try {
        await this.engine.resume();
        await this.audioElement.play();

        this.updatePlaybackStatus("Playing");
        this.message("Audio playing through RawsoniEQ.");
    } catch (error) {
        this.updatePlaybackStatus("Playback failed");
        this.message(`Playback failed: ${error.message}`);
    }
}


    pause() {
        this.audioElement.pause();
        this.updatePlaybackStatus("Paused");
    }

    stop() {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
        this.updatePlaybackStatus("Stopped");
    }

    applyPreset(values) {
        this.gains = [...values];

        this.gains.forEach((gain, index) => {
            const slider = document.getElementById(`eq-gain-${index}`);
            const output = document.getElementById(`eq-value-${index}`);

            if (slider) slider.value = gain;
            if (output) output.textContent = `${gain} dB`;
        });

        this.gains.forEach((gain, index) => {
            if (this.engine && this.engine.isInitialized) {
                this.engine.setBandGain(index, gain);
            }
        });

        this.message("Preset selected.");
    }

    savePreset() {
        const name = window.prompt("Enter a name for your custom preset:");

        if (!name || !name.trim()) return;

        try {
            const saved = JSON.parse(
                localStorage.getItem("rawsoni-custom-presets") || "{}"
            );

            saved[name.trim()] = [...this.gains];

            localStorage.setItem(
                "rawsoni-custom-presets",
                JSON.stringify(saved)
            );

            this.message(`Preset "${name.trim()}" saved in this browser.`);
        } catch (error) {
            this.message("Unable to save preset in this browser.");
        }
    }

    formatTime(seconds) {
        if (!Number.isFinite(seconds)) return "00:00";

        const minutes = Math.floor(seconds / 60);
        const remaining = Math.floor(seconds % 60);

        return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
    }

    updatePlaybackStatus(status) {
        const element = document.getElementById("playback-status");
        if (element) element.textContent = status;
    }

    renderSpatialPositioner() {
        const container = document.getElementById("spatial-positioner");

        if (!container) return;

        container.innerHTML = `
            <div class="positioner-stage">
                <div class="positioner-grid"></div>

                <div class="sound-source" id="sound-source">
                    <span>●</span>
                </div>
            </div>

            <div class="positioner-controls">
                <label>
                    X Position
                    <input type="range" id="spatial-x"
                        min="-10" max="10" value="0">
                    <output id="spatial-x-value">0</output>
                </label>

                <label>
                    Y Position
                    <input type="range" id="spatial-y"
                        min="-10" max="10" value="0">
                    <output id="spatial-y-value">0</output>
                </label>

                <label>
                    Z Position
                    <input type="range" id="spatial-z"
                        min="-10" max="10" value="0">
                    <output id="spatial-z-value">0</output>
                </label>
            </div>
        `;
    
        const source = document.getElementById("sound-source");

        const sliders = {
            x: document.getElementById("spatial-x"),
            y: document.getElementById("spatial-y"),
            z: document.getElementById("spatial-z")
        };

        const updatePosition = () => {
            const x = Number(sliders.x.value);
            const y = Number(sliders.y.value);
            const z = Number(sliders.z.value);
if (window.rawsoniStudio.engine.spatialPanner) {
    window.rawsoniStudio.engine.spatialPanner.positionX.setValueAtTime(
        x,
        window.rawsoniStudio.engine.context.currentTime
    );

    window.rawsoniStudio.engine.spatialPanner.positionY.setValueAtTime(
        y,
        window.rawsoniStudio.engine.context.currentTime
    );

    window.rawsoniStudio.engine.spatialPanner.positionZ.setValueAtTime(
        z,
        window.rawsoniStudio.engine.context.currentTime
    );
}

            source.style.left = `${50 + x * 4}%`;
            source.style.top = `${50 - y * 4}%`;

           source.style.transform =
    `translate(-50%, -50%) translateZ(${z * 12}px) scale(${1 + z * 0.025})`;

            document.getElementById("spatial-x-value").textContent = x;
            document.getElementById("spatial-y-value").textContent = y;
            document.getElementById("spatial-z-value").textContent = z;
        };

        Object.values(sliders).forEach(slider => {
            slider.addEventListener("input", updatePosition);
        });

                updatePosition();
    }

    message(text) {
        const element = document.getElementById("studio-message");
        if (element) element.textContent = text;
    }
}

window.addEventListener("DOMContentLoaded", () => {
    if (window.RawsoniAudioEngine) {
        window.rawsoniStudio = new RawsoniStudio();
        window.rawsoniStudio.start();
    }
});
