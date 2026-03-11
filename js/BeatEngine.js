class BeatEngine {
    constructor() {
        this.bpm        = C.BPM;
        this.beatMs     = (60 / this.bpm) * 1000;
        this.lastBeatMs = 0;
        this.beatCount  = 0;
        this.active     = false;
        this._listeners = [];
    }

    async start() {
        await Tone.start();
        Tone.getTransport().bpm.value = this.bpm;

        // ── Instruments ─────────────────────────────────────────────
        const kick = new Tone.MembraneSynth({
            pitchDecay: 0.06, octaves: 7,
            envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.1 },
        }).toDestination();

        const snare = new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.04 },
        }).toDestination();
        snare.volume.value = -6;

        const hihat = new Tone.MetalSynth({
            frequency: 500, envelope: { attack: 0.001, decay: 0.04, release: 0.01 },
            harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5,
        }).toDestination();
        hihat.volume.value = -18;

        const bass = new Tone.MonoSynth({
            oscillator: { type: 'sawtooth' },
            envelope: { attack: 0.01, decay: 0.12, sustain: 0.5, release: 0.1 },
            filterEnvelope: { attack: 0.01, decay: 0.08, sustain: 0.4, release: 0.1, baseFrequency: 180, octaves: 2.5 },
        }).toDestination();
        bass.volume.value = -8;

        const lead = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'square' },
            envelope: { attack: 0.005, decay: 0.08, sustain: 0.25, release: 0.15 },
        }).toDestination();
        lead.volume.value = -16;

        // ── Patterns ────────────────────────────────────────────────
        // 16 16th-notes per bar, fired every '16n'
        // Kick: double-kick feel on 1, 2+e, 3
        new Tone.Sequence((time, v) => {
            if (!v) return;
            kick.triggerAttackRelease('C1', '16n', time);
            this.lastBeatMs = performance.now();
            this.beatCount++;
            this._listeners.forEach(cb => cb(this.beatCount));
        }, [1,0,1,0, 0,0,1,0, 1,0,1,0, 0,1,0,0], '16n').start(0);

        new Tone.Sequence((time, v) => {
            if (!v) return;
            snare.triggerAttackRelease('8n', time);
        }, [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], '16n').start(0);

        new Tone.Sequence((time, v) => {
            if (!v) return;
            hihat.triggerAttackRelease('16n', time);
        }, [1,1,0,1, 1,0,1,1, 1,1,0,1, 1,0,1,1], '16n').start(0);

        // Bass riff in C minor
        const bassNotes = ['C2','C2',null,'G2', null,'A#1',null,'C2', 'C2',null,'G2',null, null,'F2','G2',null];
        new Tone.Sequence((time, note) => {
            if (!note) return;
            bass.triggerAttackRelease(note, '8n', time);
        }, bassNotes, '8n').start(0);

        // Lead riff
        const leadNotes = [
            ['C4','G4'], null, null, null,
            ['A#3','F4'], null, null, null,
            ['G3','D4'], null, null, null,
            ['F3','C4'], null, null, null,
        ];
        new Tone.Sequence((time, chord) => {
            if (!chord) return;
            lead.triggerAttackRelease(chord, '8n', time);
        }, leadNotes, '8n').start(0);

        Tone.getTransport().start();
        this.active = true;
    }

    stop() {
        Tone.getTransport().stop();
        this.active = false;
    }

    // Returns true if we're within BEAT_WINDOW_MS of a beat
    isOnBeat() {
        if (!this.active) return false;
        const elapsed = performance.now() - this.lastBeatMs;
        const toNext  = this.beatMs - elapsed;
        return elapsed < C.BEAT_WINDOW_MS || toNext < C.BEAT_WINDOW_MS;
    }

    // 0 = right on beat, 1 = halfway to next beat
    beatPhase() {
        if (!this.active) return 0;
        return Math.min(1, (performance.now() - this.lastBeatMs) / this.beatMs);
    }

    onBeat(cb) { this._listeners.push(cb); }
}
