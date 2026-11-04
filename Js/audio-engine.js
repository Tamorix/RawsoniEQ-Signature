
/*
 * RawsoniEQ Signature by TAMORIX
 * Browser Audio Engine
 *
 * This module initializes the Web Audio API processing chain.
 * Equalizer controls and file playback will be connected in
 * the next development steps.
 */

"use strict";

class RawsoniAudioEngine {
    constructor() {
        this.context = null;
        this.source = null;
this.audioElement = null;
this.objectURL = null;
        this.audioBuffer = null;
        this.filters = [];
        this.analyser = null;
        this.masterGain = null;
        this.isInitialized = false;

        this.bandFrequencies = [
            31.25,
            62.5,
            125,
            250,
            500,
            1000,
            2000,
            4000,
            8000,
            16000
        ];

        this.gains = new Array(10).fill(0);
    }

getFrequencies(count) {
    if (![10, 20, 30].includes(count)) {
        throw new RangeError("EQ band count must be 10, 20, or 30.");
    }

    if (count === 10) {
        return [
            31.25, 62.5, 125, 250, 500,
            1000, 2000, 4000, 8000, 16000
        ];
    }

    const minFrequency = 31.25;
    const maxFrequency = 16000;

    return Array.from({ length: count }, (_, index) =>
        minFrequency * Math.pow(
            maxFrequency / minFrequency,
            index / (count - 1)
        )
    );
}


    async initialize() {
        if (this.isInitialized) {
            return true;
        }

        const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) {
            throw new Error(
                "Web Audio API is not supported by this browser."
            );
        }

        this.context = new AudioContextClass();

        this.masterGain = this.context.createGain();
        this.analyser = this.context.createAnalyser();

        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.8;

        this.createEqualizer();

        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.context.destination);

        this.isInitialized = true;

        return true;
    }

    createEqualizer() {
        let previousNode = null;

        this.filters = this.bandFrequencies.map((frequency, index) => {
            const filter = this.context.createBiquadFilter();

            filter.type = index === 0
                ? "lowshelf"
                : index === this.bandFrequencies.length - 1
                    ? "highshelf"
                    : "peaking";

            filter.frequency.value = frequency;
            filter.Q.value = 1.0;
            filter.gain.value = this.gains[index];

            if (previousNode) {
                previousNode.connect(filter);
            }

            previousNode = filter;

            return filter;
        });

        this.filters[this.filters.length - 1].connect(this.masterGain);
    }
setBandCount(count) {
    if (![10, 20, 30].includes(count)) {
        throw new RangeError("EQ band count must be 10, 20, or 30.");
    }

    if (!this.isInitialized) {
        throw new Error("Initialize the audio engine first.");
    }

    const oldGains = this.gains;
    const oldFrequencies = this.bandFrequencies;

    const newFrequencies = this.getFrequencies(count);

    const newGains = newFrequencies.map((_, index) => {
        if (count === oldGains.length) {
            return oldGains[index] ?? 0;
        }

        const frequency = newFrequencies[index];

        let nearestIndex = 0;
        let nearestDistance = Infinity;

        oldFrequencies.forEach((oldFrequency, oldIndex) => {
            const distance = Math.abs(
                Math.log(frequency / oldFrequency)
            );

            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = oldIndex;
            }
        });

        return oldGains[nearestIndex] ?? 0;
    });

    // Disconnect the old filter chain without disconnecting the audio source.
    this.filters.forEach(filter => {
        filter.disconnect();
    });

    this.bandFrequencies = newFrequencies;
    this.gains = newGains;

    this.createEqualizer();

    if (this.source) {
        this.source.disconnect();
        this.source.connect(this.filters[0]);
    }

    return true;
}

connectAudioSource(audioElement) {
    if (!this.isInitialized) {
        throw new Error("Initialize the audio engine first.");
    }

    if (!(audioElement instanceof HTMLMediaElement)) {
        throw new TypeError("A valid audio element is required.");
    }

    if (this.source) {
        this.source.disconnect();
    }

    this.source = this.context.createMediaElementSource(audioElement);

    this.source.connect(this.filters[0]);
    this.audioElement = audioElement;

    return true;
}

loadAudioFile(file, audioElement) {
    if (!(file instanceof File)) {
        throw new TypeError("Please select a valid audio file.");
    }

    if (!file.type.startsWith("audio/")) {
        throw new TypeError("The selected file must be an audio file.");
    }

    if (!(audioElement instanceof HTMLMediaElement)) {
        throw new TypeError("A valid audio player is required.");
    }

    if (this.objectURL) {
        URL.revokeObjectURL(this.objectURL);
    }

    this.objectURL = URL.createObjectURL(file);
    audioElement.src = this.objectURL;
    audioElement.load();

    this.audioElement = audioElement;

    return {
        name: file.name,
        type: file.type,
        size: file.size
    };
}

async play() {
    if (!this.audioElement) {
        throw new Error("Load an audio file before playing.");
    }

    await this.resume();

    this.audioElement.play().catch((error) => {
        console.error("Audio playback failed:", error);
    });
}

pause() {
    if (this.audioElement) {
        this.audioElement.pause();
    }
}


    async resume() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (this.context.state === "suspended") {
            await this.context.resume();
        }
    }

    setBandGain(index, gainDB) {
        if (!Number.isInteger(index) ||
            index < 0 ||
            index >= this.gains.length) {
            throw new RangeError("Invalid EQ band index.");
        }

        const gain = Number(gainDB);

        if (!Number.isFinite(gain)) {
            throw new TypeError("Gain must be a finite number.");
        }

        const safeGain = Math.max(-12, Math.min(12, gain));

        this.gains[index] = safeGain;

        if (this.filters[index]) {
            this.filters[index].gain.setTargetAtTime(
                safeGain,
                this.context.currentTime,
                0.015
            );
        }

        return safeGain;
    }

   setAllGains(gains) {
    if (!Array.isArray(gains) ||
        gains.length !== this.bandFrequencies.length) {
        throw new TypeError(
            `The ${this.bandFrequencies.length}-band EQ requires exactly ${this.bandFrequencies.length} gain values.`
        );
    }

    return gains.map((gain, index) =>
        this.setBandGain(index, gain)
    );
}

async decodeAudioFile(file) {
    if (!this.context) {
        await this.initialize();
    }

    const arrayBuffer = await file.arrayBuffer();

    return await this.context.decodeAudioData(arrayBuffer);
}

async renderOfflineEQ(audioBuffer, gains) {if (!Array.isArray(gains) ||
    gains.length !== this.bandFrequencies.length) {
    throw new TypeError(
        `Expected ${this.bandFrequencies.length} EQ gain values.`
    );
}
    const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    let previousNode = source;

    const frequencies = this.bandFrequencies;

   frequencies.forEach((frequency, index) => {
    const filter = offlineContext.createBiquadFilter();

    filter.type = index === 0
        ? "lowshelf"
        : index === frequencies.length - 1
            ? "highshelf"
            : "peaking";

    filter.frequency.value = frequency;
    filter.Q.value = 1.0;
    filter.gain.value = gains[index] ?? 0;

    previousNode.connect(filter);
    previousNode = filter;
});

    previousNode.connect(offlineContext.destination);

    source.start(0);

    return await offlineContext.startRendering();
}

audioBufferToWav(audioBuffer) {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numberOfChannels * bytesPerSample;
    const dataSize =
        audioBuffer.length * numberOfChannels * bytesPerSample;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset, text) => {
        for (let i = 0; i < text.length; i++) {
            view.setUint8(offset + i, text.charCodeAt(i));
        }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, "data");
    view.setUint32(40, dataSize, true);

    let offset = 44;

    for (let i = 0; i < audioBuffer.length; i++) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
            const sample = Math.max(
                -1,
                Math.min(1, audioBuffer.getChannelData(channel)[i])
            );

            const pcm = sample < 0
                ? sample * 32768
                : sample * 32767;

            view.setInt16(offset, pcm, true);
            offset += bytesPerSample;
        }
    }

    return new Blob([buffer], { type: "audio/wav" });
}

async exportWav(file, gains) {
    try {
        const decodedAudio = await this.decodeAudioFile(file);

        const processedAudio = await this.renderOfflineEQ(
            decodedAudio,
            gains
        );

        return this.audioBufferToWav(processedAudio);
    } catch (error) {
        console.error("RawsoniEQ WAV export failed:", error);
        throw error;
    }
}

    getFrequencyResponse() {
        if (!this.isInitialized) {
            return null;
        }

        const frequencies = new Float32Array(256);

        const minFrequency = 20;
        const maxFrequency = 20000;

        for (let i = 0; i < frequencies.length; i++) {
            frequencies[i] = minFrequency * Math.pow(
                maxFrequency / minFrequency,
                i / (frequencies.length - 1)
            );
        }

        const magnitude = new Float32Array(frequencies.length);
        const phase = new Float32Array(frequencies.length);

        this.filters[0].getFrequencyResponse(
            frequencies,
            magnitude,
            phase
        );

        return {
            frequencies,
            magnitude,
            phase
        };
    }

    getStatus() {
        return {
            initialized: this.isInitialized,
            audioContextState: this.context
                ? this.context.state
                : "not initialized",
            bandCount: this.bandFrequencies.length,
            frequencies: [...this.bandFrequencies],
            gains: this.getGains()
        };
    }
}

window.RawsoniAudioEngine = RawsoniAudioEngine;
